import { Client } from 'colyseus';
import {
  type Card,
  type Rank,
  type Seat,
  type Suit,
  createDeck,
  shuffle,
  tableShuffle,
  determineTrickWinner,
  legalCards,
  teamForSeat,
  shelem,
} from '@shelem/shared';
import { GameState, BidRecord, TrickPlay, HandResult } from '../schema/GameState.js';
import { BaseTableRoom, cardsEqual, HAND_REVIEW_MS, type JoinOptions } from './BaseTableRoom.js';

type Bid = shelem.Bid;
type BidEvent = shelem.BidEvent;
const {
  deal,
  isValidBid,
  resolveBidding,
  trickPoints,
  resolveHandScore,
  isMatchComplete,
  validateTableConfig,
} = shelem;

/** Shelem: 12 played tricks, the 13th being the declarer's buried widow discard. */
const TRICKS_PLAYED_PER_HAND = 12;

export class ShelemRoom extends BaseTableRoom<GameState> {
  // Server-only, never synced.
  private widow: Card[] = [];
  private bidEvents: BidEvent[] = [];
  private currentHighestBid: Bid | null = null;
  private passedSeats = new Set<Seat>();
  // True for the brief pause after a trick's 4th card is played, while it's still
  // shown on screen — blocks the next trick's lead until resolveTrick() runs.
  private resolvingTrick = false;
  // Each team stacks the tricks it wins, in the order it won them, cards in play order —
  // exactly as the cards end up piled on the table. Combined at the end of the hand into
  // `collectedDeck`, which is then lightly shuffled and dealt again. This is what carries
  // suit grouping from one hand into the next; see `tableShuffle`.
  private teamPiles: [Card[], Card[]] = [[], []];
  // The previous hand's cards, awaiting the next deal. Null before the first hand.
  private collectedDeck: Card[] | null = null;

  protected createState(options: JoinOptions): GameState {
    const state = new GameState();
    // The create-table screen validates the same config before sending it, so a
    // rejection here means a client that isn't ours — fail the create loudly rather
    // than quietly seating people at a table with rules nobody chose.
    const validated = validateTableConfig(options.config ?? {});
    if (!validated.ok) throw new Error(`Invalid table settings: ${validated.error}`);
    state.config.applyConfig(validated.config);
    return state;
  }

  protected registerGameMessages() {
    this.onMessage('setTableConfig', (client, message) => this.handleSetTableConfig(client, message));
    this.onMessage('bid', (client, message) => this.handleBid(client, message));
    this.onMessage('discardWidow', (client, message) => this.handleDiscardWidow(client, message));
    this.onMessage('confirmSarShelemWidow', (client) => this.handleConfirmSarShelemWidow(client));
    this.onMessage('playCard', (client, message) => this.handlePlayCard(client, message));
  }

  /** The rules are normally settled before the room exists, on the create-table
   * screen. This exists for the other time a table needs them: after a rematch, when
   * the newly drawn host is sent back to that same screen with the room already up.
   *
   * Setting the rules and leaving the configure phase are one message rather than two
   * so they can't come apart: a rejected config that still let the table advance would
   * start the match under rules nobody chose. Either the whole config is accepted and
   * the table moves to the lobby, or nothing happens and the host is told why. */
  private handleSetTableConfig(client: Client, message: unknown) {
    if (this.state.phase !== 'configuring') return;
    if (client.sessionId !== this.state.hostSessionId) {
      client.send('actionRejected', { action: 'setTableConfig', reason: 'Only the host can change table settings' });
      return;
    }

    const validated = validateTableConfig(message);
    if (!validated.ok) {
      client.send('actionRejected', { action: 'setTableConfig', reason: validated.error });
      return;
    }

    this.state.config.applyConfig(validated.config);
    this.state.phase = 'lobby';
  }

  // ---- Bidding ----

  private handleBid(client: Client, message: { bidType?: string; amount?: number }) {
    if (this.state.phase !== 'bidding') return;
    const seat = this.seatBySessionId.get(client.sessionId);
    if (seat === undefined || seat !== this.state.currentTurnSeat) return;
    if (this.passedSeats.has(seat)) return;

    const bid = this.parseBid(message);
    if (!bid || !isValidBid(bid, this.currentHighestBid)) {
      client.send('actionRejected', { action: 'bid', reason: 'Invalid bid' });
      return;
    }

    this.bidEvents.push({ seat, bid });
    const record = new BidRecord();
    record.seat = seat;
    record.bidType = bid.type;
    record.amount = bid.type === 'numeric' ? bid.amount : 0;
    this.state.bidHistory.push(record);

    if (bid.type === 'pass') {
      this.passedSeats.add(seat);
    } else {
      this.currentHighestBid = bid;
      this.passedSeats.delete(seat);
    }

    const resolution = resolveBidding(this.bidEvents);
    if (!resolution.complete) {
      this.state.currentTurnSeat = this.nextActiveSeat(seat);
      return;
    }

    if (resolution.redeal) {
      // Nobody took the bid, so the cards get gathered back up and dealt again rather
      // than a fresh deck appearing from nowhere.
      this.collectedDeck = [...this.hands.flat(), ...this.widow];
      this.startHand();
      return;
    }

    const declarerSeat = resolution.declarerSeat!;
    const winningBid = resolution.winningBid!;
    this.state.declarerSeat = declarerSeat;
    this.state.winningBidType = winningBid.type;
    this.state.winningBidAmount = winningBid.type === 'numeric' ? winningBid.amount : 0;
    this.state.phase = 'widow';
    this.state.currentTurnSeat = declarerSeat;

    // Sar-Shelem is normally played without the widow exchange: the declarer is shown
    // the four cards and they are then buried as their discard, unchosen. The reveal
    // goes only to them — the defenders learn nothing about which cards are out. A
    // table can turn the exchange on, in which case it plays like any other contract.
    if (winningBid.type === 'sarShelem' && !this.state.config.sarShelemTakesWidow) {
      this.clientFor(declarerSeat)?.send('sarShelemWidow', this.widow);
      return;
    }

    this.hands[declarerSeat] = this.hands[declarerSeat].concat(this.widow);
    this.widow = [];
    this.sendHand(declarerSeat);
  }

  /** The declarer has seen the Sar-Shelem widow and is ready to play. The four
   * cards are buried exactly as a chosen discard would be — they become the
   * declaring team's first trick, points included, which is what makes the
   * contract reachable at all: a widow holding an ace would otherwise put all 165
   * out of reach before a card was played. */
  private handleConfirmSarShelemWidow(client: Client) {
    if (this.state.phase !== 'widow') return;
    if (this.state.winningBidType !== 'sarShelem') return;
    if (this.state.config.sarShelemTakesWidow) return;
    const seat = this.seatBySessionId.get(client.sessionId);
    if (seat === undefined || seat !== this.state.declarerSeat) return;

    this.state.declarerPointsCollected += trickPoints(this.widow);
    this.teamPiles[teamForSeat(seat)].push(...this.widow);
    this.widow = [];

    this.state.phase = 'playing';
    this.state.currentTurnSeat = seat;
  }

  private nextActiveSeat(from: Seat): Seat {
    let seat = ((from + 1) % 4) as Seat;
    while (this.passedSeats.has(seat)) {
      seat = ((seat + 1) % 4) as Seat;
    }
    return seat;
  }

  private parseBid(message: { bidType?: string; amount?: number }): Bid | null {
    switch (message.bidType) {
      case 'pass':
        return { type: 'pass' };
      case 'shelem':
        return { type: 'shelem' };
      case 'sarShelem':
        return { type: 'sarShelem' };
      case 'numeric':
        if (typeof message.amount !== 'number') return null;
        return { type: 'numeric', amount: message.amount };
      default:
        return null;
    }
  }

  // ---- Widow / discard ----

  private handleDiscardWidow(client: Client, message: { cards?: { suit: Suit; rank: Rank }[] }) {
    if (this.state.phase !== 'widow') return;
    // A Sar-Shelem declarer never chooses a discard; theirs is buried for them —
    // unless this table plays Sar-Shelem with the exchange.
    if (this.state.winningBidType === 'sarShelem' && !this.state.config.sarShelemTakesWidow) return;
    const seat = this.seatBySessionId.get(client.sessionId);
    if (seat === undefined || seat !== this.state.declarerSeat) return;

    const requested = message.cards ?? [];
    if (requested.length !== 4) {
      client.send('actionRejected', { action: 'discardWidow', reason: 'Must discard exactly 4 cards' });
      return;
    }

    const hand = this.hands[seat].slice();
    const discarded: Card[] = [];
    for (const wanted of requested) {
      const index = hand.findIndex((c) => cardsEqual(c, wanted));
      if (index === -1) {
        client.send('actionRejected', { action: 'discardWidow', reason: 'Card not in hand' });
        return;
      }
      discarded.push(hand.splice(index, 1)[0]);
    }

    this.hands[seat] = hand;
    this.state.declarerPointsCollected += trickPoints(discarded);
    // The buried cards sit under the declarer team's pile, where they were set aside.
    this.teamPiles[teamForSeat(seat)].push(...discarded);

    this.state.phase = 'playing';
    this.state.currentTurnSeat = seat;
    this.sendHand(seat);
  }

  // ---- Playing ----

  private handlePlayCard(client: Client, message: { suit?: Suit; rank?: Rank }) {
    if (this.state.phase !== 'playing') return;
    if (this.resolvingTrick) return;
    const seat = this.seatBySessionId.get(client.sessionId);
    if (seat === undefined || seat !== this.state.currentTurnSeat) return;
    if (!message.suit || !message.rank) return;

    const card: Card = { suit: message.suit, rank: message.rank };
    const hand = this.hands[seat];
    const index = hand.findIndex((c) => cardsEqual(c, card));
    if (index === -1) {
      client.send('actionRejected', { action: 'playCard', reason: 'Card not in hand' });
      return;
    }

    const isLeading = this.state.currentTrick.length === 0;
    const trumpNotYetSet = this.state.trumpSuit === '';

    if (!isLeading) {
      const leadSuit = this.state.currentTrick[0].suit as Suit;
      const legal = legalCards(hand, leadSuit, this.state.trumpSuit as Suit);
      if (!legal.some((c) => cardsEqual(c, card))) {
        client.send('actionRejected', { action: 'playCard', reason: 'Illegal move' });
        return;
      }
    }

    hand.splice(index, 1);
    const play = new TrickPlay();
    play.seat = seat;
    play.suit = card.suit;
    play.rank = card.rank;
    this.state.currentTrick.push(play);

    // Shelem has no trump declaration — the suit of the declarer's opening lead is
    // trump, and that is the only way it is ever set.
    if (isLeading && trumpNotYetSet) {
      this.state.trumpSuit = card.suit;
    }

    this.sendHand(seat);

    if (this.state.currentTrick.length < 4) {
      this.state.currentTurnSeat = ((seat + 1) % 4) as Seat;
      return;
    }

    // Hold the completed trick on everyone's screen for a beat before clearing it —
    // otherwise the 4th card's own broadcast already carries the cleared trick, and
    // the last play never visibly appears. `resolvingTrick` blocks new plays (turn
    // hasn't advanced yet) until the pause completes.
    this.resolvingTrick = true;
    this.clock.setTimeout(() => {
      this.resolvingTrick = false;
      this.resolveTrick();
    }, 1500);
  }

  private resolveTrick() {
    const plays = this.state.currentTrick.map((p) => ({
      seat: p.seat as Seat,
      card: { suit: p.suit as Suit, rank: p.rank as Rank },
    }));
    const winnerSeat = determineTrickWinner(plays, this.state.trumpSuit as Suit);
    const points = trickPoints(plays.map((p) => p.card));

    if (teamForSeat(winnerSeat) === teamForSeat(this.state.declarerSeat as Seat)) {
      this.state.declarerPointsCollected += points;
    } else {
      this.state.defenderPointsCollected += points;
    }

    // The winner scoops the trick face-down onto their team's pile, cards still in the
    // order they were played — led suit first, which is what keeps suits grouped.
    this.teamPiles[teamForSeat(winnerSeat)].push(...plays.map((p) => p.card));

    // Keep a copy for the last-trick review before the live trick is cleared.
    // Fresh TrickPlay instances rather than the originals: a Colyseus schema
    // instance belongs to exactly one array, so re-pushing the same objects here
    // would pull them out of `currentTrick` instead of duplicating them.
    this.state.lastTrick.clear();
    for (const play of plays) {
      const copy = new TrickPlay();
      copy.seat = play.seat;
      copy.suit = play.card.suit;
      copy.rank = play.card.rank;
      this.state.lastTrick.push(copy);
    }
    this.state.lastTrickWinnerSeat = winnerSeat;
    this.state.lastTrickPoints = points;

    this.state.tricksPlayedThisHand += 1;
    this.state.currentTrick.clear();
    this.state.currentTurnSeat = winnerSeat;

    if (this.state.tricksPlayedThisHand >= TRICKS_PLAYED_PER_HAND) {
      this.completeHand();
    }
  }

  private completeHand() {
    const bid = this.currentHighestBid;
    if (!bid || bid.type === 'pass') {
      throw new Error('Hand completed without a resolved bid — this should be unreachable');
    }

    const { declarerDelta, defenderDelta, declarerMadeBid } = resolveHandScore(
      bid,
      this.state.declarerPointsCollected,
      this.state.defenderPointsCollected,
      this.state.config,
    );

    const declarerTeam = teamForSeat(this.state.declarerSeat as Seat);
    const declarerTeamDelta = declarerDelta;
    const defenderTeamDelta = defenderDelta;
    if (declarerTeam === 0) {
      this.state.team0Score += declarerTeamDelta;
      this.state.team1Score += defenderTeamDelta;
    } else {
      this.state.team1Score += declarerTeamDelta;
      this.state.team0Score += defenderTeamDelta;
    }

    // Recorded here, before startHand() below bumps handNumber to the next deal.
    const result = new HandResult();
    result.handNumber = this.state.handNumber;
    result.declarerSeat = this.state.declarerSeat;
    result.bidType = bid.type;
    result.bidAmount = bid.type === 'numeric' ? bid.amount : 0;
    result.declarerMadeBid = declarerMadeBid;
    result.team0Delta = declarerTeam === 0 ? declarerTeamDelta : defenderTeamDelta;
    result.team1Delta = declarerTeam === 1 ? declarerTeamDelta : defenderTeamDelta;
    result.team0Total = this.state.team0Score;
    result.team1Total = this.state.team1Score;
    this.state.handHistory.push(result);

    // The two piles get squared together into one deck for the next deal. Which team's
    // pile ends up on top isn't fixed at a real table, so don't fix it here either.
    const [pile0, pile1] = this.teamPiles;
    this.collectedDeck = Math.random() < 0.5 ? pile0.concat(pile1) : pile1.concat(pile0);

    if (isMatchComplete({ team0: this.state.team0Score, team1: this.state.team1Score }, this.state.config.targetScore)) {
      this.state.phase = 'matchComplete';
      return;
    }

    // Hold on the finished hand so everyone can read what just happened, rather
    // than dealing the next one out from under them. The pause lives here, not on
    // each client, so the whole table moves together.
    this.state.phase = 'handComplete';
    this.state.currentTurnSeat = -1;
    this.clock.setTimeout(() => {
      this.state.dealerSeat = ((this.state.dealerSeat + 1) % 4) as Seat;
      this.startHand();
    }, HAND_REVIEW_MS);
  }

  /** A fresh match starts from a fully randomised deck (see docs/game-rules.md):
   * there's no previous hand for this one to inherit, so the carried-over deck is
   * dropped. */
  protected resetGameForRematch() {
    this.state.handHistory.clear();
    this.state.declarerPointsCollected = 0;
    this.state.defenderPointsCollected = 0;
    this.state.declarerSeat = -1;
    this.state.winningBidType = '';
    this.state.winningBidAmount = 0;
    this.state.lastTrickPoints = 0;
    this.state.bidHistory.clear();
    this.state.tricksPlayedThisHand = 0;

    this.collectedDeck = null;
    this.teamPiles = [[], []];
    this.currentHighestBid = null;
    this.bidEvents = [];
    this.passedSeats = new Set();
    this.resolvingTrick = false;
  }

  // ---- Hand lifecycle ----

  /**
   * The deck for the next deal. Normally last hand's cards given a light shuffle, which
   * is what carries suit grouping forward. Only the very first hand of a match starts
   * from a fresh, fully randomised deck — there's no previous hand to inherit from.
   * A table set to `random` shuffle mode starts every hand from one instead.
   */
  private nextDeck(): Card[] {
    const collected = this.collectedDeck;
    this.collectedDeck = null;
    if (this.state.config.shuffleMode === 'random') return shuffle(createDeck());
    if (collected && collected.length === 52) {
      return tableShuffle(collected);
    }
    return shuffle(createDeck());
  }

  protected startHand() {
    const deck = this.nextDeck();
    const { hands, widow } = deal(deck, this.state.dealerSeat as Seat);
    this.hands = hands;
    this.widow = widow;
    this.teamPiles = [[], []];
    this.bidEvents = [];
    this.currentHighestBid = null;
    this.passedSeats = new Set();
    this.resolvingTrick = false;
    this.state.declarerPointsCollected = 0;
    this.state.defenderPointsCollected = 0;

    this.state.phase = 'bidding';
    this.state.declarerSeat = -1;
    this.state.winningBidType = '';
    this.state.winningBidAmount = 0;
    this.state.trumpSuit = '';
    this.state.currentTrick.clear();
    this.state.lastTrick.clear();
    this.state.lastTrickWinnerSeat = -1;
    this.state.lastTrickPoints = 0;
    this.state.tricksPlayedThisHand = 0;
    this.state.bidHistory.clear();
    this.state.handNumber += 1;

    const firstBidder = ((this.state.dealerSeat + 1) % 4) as Seat;
    this.state.currentTurnSeat = firstBidder;

    for (let seat = 0; seat < 4; seat++) {
      this.state.players[seat].handSize = this.hands[seat].length;
      this.sendHand(seat as Seat);
    }
  }
}
