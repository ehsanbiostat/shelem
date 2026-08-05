import { Room, Client } from 'colyseus';
import {
  type Bid,
  type BidEvent,
  type Card,
  type Rank,
  type Seat,
  type Suit,
  createDeck,
  shuffle,
  tableShuffle,
  deal,
  isValidBid,
  resolveBidding,
  determineTrickWinner,
  legalCards,
  trickPoints,
  resolveHandScore,
  isMatchComplete,
  teamForSeat,
} from '@shelem/shared';
import { GameState, PlayerInfo, BidRecord, TrickPlay, SeatSwapRequest, HandResult } from '../schema/GameState.js';

interface JoinOptions {
  name?: string;
  targetScore?: number;
}

/** Bounds on the host-configurable match target. The floor is one hand's worth of
 * points (165 — see docs/game-rules.md), below which a match would be decided by a
 * single deal; the ceiling just keeps a typo from producing an unwinnable table.
 * Multiples of 5 because every score in the game is one. */
const MIN_TARGET_SCORE = 165;
const MAX_TARGET_SCORE = 10000;

function isValidTargetScore(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value % 5 === 0 &&
    value >= MIN_TARGET_SCORE &&
    value <= MAX_TARGET_SCORE
  );
}

function cardsEqual(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

export class ShelemRoom extends Room<GameState> {
  maxClients = 4;

  // Server-only, never synced: actual hand contents, hidden until legitimately revealed.
  private hands: Card[][] = [[], [], [], []];
  private widow: Card[] = [];
  private bidEvents: BidEvent[] = [];
  private currentHighestBid: Bid | null = null;
  private passedSeats = new Set<Seat>();
  private seatBySessionId = new Map<string, Seat>();
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

  onCreate(options: JoinOptions) {
    const state = new GameState();
    if (isValidTargetScore(options.targetScore)) {
      state.matchTargetScore = options.targetScore;
    }
    for (let seat = 0; seat < 4; seat++) {
      const player = new PlayerInfo();
      player.seat = seat;
      state.players.push(player);
    }
    this.state = state;

    this.onMessage('startGame', (client) => this.handleStartGame(client));
    this.onMessage('setTableOption', (client, message) => this.handleSetTableOption(client, message));
    this.onMessage('bid', (client, message) => this.handleBid(client, message));
    this.onMessage('discardWidow', (client, message) => this.handleDiscardWidow(client, message));
    this.onMessage('playCard', (client, message) => this.handlePlayCard(client, message));
    this.onMessage('requestSeatSwap', (client, message) => this.handleRequestSeatSwap(client, message));
    this.onMessage('respondSeatSwap', (client, message) => this.handleRespondSeatSwap(client, message));
  }

  onJoin(client: Client, options: JoinOptions) {
    const seat = this.state.players.findIndex((p) => p.sessionId === '');
    if (seat === -1) {
      throw new Error('Table is full');
    }

    const player = this.state.players[seat];
    player.sessionId = client.sessionId;
    player.name = options.name?.trim() || `Player ${seat + 1}`;
    player.connected = true;
    this.seatBySessionId.set(client.sessionId, seat as Seat);

    // First player to sit down is whoever created the table, and becomes host.
    if (this.state.hostSessionId === '') {
      this.state.hostSessionId = client.sessionId;
    }
  }

  /** Table settings, changeable by the host right up until the game starts — a
   * table's target score is something everyone should be able to see and agree on
   * before the first deal, not a value baked in at creation that only the creator
   * ever saw. */
  private handleSetTableOption(client: Client, message: { targetScore?: number }) {
    if (this.state.phase !== 'lobby') return;
    if (client.sessionId !== this.state.hostSessionId) {
      client.send('actionRejected', { action: 'setTableOption', reason: 'Only the host can change table settings' });
      return;
    }

    if (message.targetScore !== undefined) {
      if (!isValidTargetScore(message.targetScore)) {
        client.send('actionRejected', {
          action: 'setTableOption',
          reason: `Target score must be a multiple of 5 between ${MIN_TARGET_SCORE} and ${MAX_TARGET_SCORE}`,
        });
        return;
      }
      this.state.matchTargetScore = message.targetScore;
    }
  }

  /** Filling the last seat only makes the table ready — it doesn't deal. Any seated
   * player can then kick off the first hand once everyone's actually ready to play,
   * rather than the room dealing out from under a player who just joined. */
  private handleStartGame(client: Client) {
    if (this.state.phase !== 'lobby') return;
    if (!this.seatBySessionId.has(client.sessionId)) return;
    const allSeated = this.state.players.every((p) => p.sessionId !== '');
    if (!allSeated) return;

    this.startHand();
  }

  async onLeave(client: Client) {
    const seat = this.seatBySessionId.get(client.sessionId);
    if (seat === undefined) return;

    const player = this.state.players[seat];
    player.connected = false;

    try {
      // No auto-kick / timeout in v1: wait a long time (24h) for the same player to
      // reconnect into their seat; the game simply pauses on their turn until then.
      await this.allowReconnection(client, 24 * 60 * 60);
      player.connected = true;
      // The synced schema state resends itself automatically on reconnect, but a
      // player's own hand is deliberately kept out of that (see the comment on
      // `hands`) and only ever pushed via a one-off message — which reconnecting
      // does NOT replay on its own, so without this the client comes back with an
      // empty hand until their next server-initiated update.
      this.sendHand(seat);
    } catch {
      // Reconnection window expired without anyone reclaiming the seat. The room is
      // left as-is (v1 has no bot fill-in or seat-vacating flow) — a future version
      // can add host controls to reset the table.
    }
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

    this.hands[declarerSeat] = this.hands[declarerSeat].concat(this.widow);
    this.widow = [];
    this.sendHand(declarerSeat);
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

    if (this.state.tricksPlayedThisHand >= 12) {
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

    if (isMatchComplete({ team0: this.state.team0Score, team1: this.state.team1Score }, this.state.matchTargetScore)) {
      this.state.phase = 'matchComplete';
      return;
    }

    this.state.dealerSeat = ((this.state.dealerSeat + 1) % 4) as Seat;
    this.startHand();
  }

  // ---- Seat swap (lobby only) ----

  private handleRequestSeatSwap(client: Client, message: { toSeat?: number }) {
    if (this.state.phase !== 'lobby') return;
    const fromSeat = this.seatBySessionId.get(client.sessionId);
    if (fromSeat === undefined || typeof message.toSeat !== 'number') return;
    if (message.toSeat < 0 || message.toSeat > 3 || message.toSeat === fromSeat) return;
    if (this.state.players[message.toSeat].sessionId === '') return;

    const request = new SeatSwapRequest();
    request.fromSeat = fromSeat;
    request.toSeat = message.toSeat;
    this.state.pendingSeatSwap = request;
  }

  private handleRespondSeatSwap(client: Client, message: { accept?: boolean }) {
    const pending = this.state.pendingSeatSwap;
    if (!pending) return;
    const seat = this.seatBySessionId.get(client.sessionId);
    if (seat === undefined || seat !== pending.toSeat) return;

    if (message.accept) {
      const a = this.state.players[pending.fromSeat];
      const b = this.state.players[pending.toSeat];
      const aSession = a.sessionId;
      const aName = a.name;
      const aConnected = a.connected;
      a.sessionId = b.sessionId;
      a.name = b.name;
      a.connected = b.connected;
      b.sessionId = aSession;
      b.name = aName;
      b.connected = aConnected;
      this.seatBySessionId.set(a.sessionId, pending.fromSeat as Seat);
      this.seatBySessionId.set(b.sessionId, pending.toSeat as Seat);
    }
    this.state.pendingSeatSwap = undefined;
  }

  // ---- Hand lifecycle ----

  /**
   * The deck for the next deal. Normally last hand's cards given a light shuffle, which
   * is what carries suit grouping forward. Only the very first hand of a match starts
   * from a fresh, fully randomised deck — there's no previous hand to inherit from.
   */
  private nextDeck(): Card[] {
    const collected = this.collectedDeck;
    this.collectedDeck = null;
    if (collected && collected.length === 52) {
      return tableShuffle(collected);
    }
    return shuffle(createDeck());
  }

  private startHand() {
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

  private sendHand(seat: Seat) {
    const player = this.state.players[seat];
    player.handSize = this.hands[seat].length;
    if (!player.sessionId) return;
    const client = this.clients.find((c) => c.sessionId === player.sessionId);
    client?.send('hand', this.hands[seat]);
  }
}
