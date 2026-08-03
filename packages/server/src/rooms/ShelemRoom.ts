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
import { GameState, PlayerInfo, BidRecord, TrickPlay, SeatSwapRequest } from '../schema/GameState.js';

interface JoinOptions {
  name?: string;
  targetScore?: number;
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
  private declarerPointsCollected = 0;
  private defenderPointsCollected = 0;
  private seatBySessionId = new Map<string, Seat>();
  // Each team stacks the tricks it wins, in the order it won them, cards in play order —
  // exactly as the cards end up piled on the table. Combined at the end of the hand into
  // `collectedDeck`, which is then lightly shuffled and dealt again. This is what carries
  // suit grouping from one hand into the next; see `tableShuffle`.
  private teamPiles: [Card[], Card[]] = [[], []];
  // The previous hand's cards, awaiting the next deal. Null before the first hand.
  private collectedDeck: Card[] | null = null;

  onCreate(options: JoinOptions) {
    const state = new GameState();
    if (options.targetScore && options.targetScore > 0) {
      state.matchTargetScore = options.targetScore;
    }
    for (let seat = 0; seat < 4; seat++) {
      const player = new PlayerInfo();
      player.seat = seat;
      state.players.push(player);
    }
    this.state = state;

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

    const allSeated = this.state.players.every((p) => p.sessionId !== '');
    if (allSeated && this.state.phase === 'lobby') {
      this.startHand();
    }
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
    this.declarerPointsCollected += trickPoints(discarded);
    // The buried cards sit under the declarer team's pile, where they were set aside.
    this.teamPiles[teamForSeat(seat)].push(...discarded);

    this.state.phase = 'playing';
    this.state.currentTurnSeat = seat;
    this.sendHand(seat);
  }

  // ---- Playing ----

  private handlePlayCard(client: Client, message: { suit?: Suit; rank?: Rank }) {
    if (this.state.phase !== 'playing') return;
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

    this.resolveTrick();
  }

  private resolveTrick() {
    const plays = this.state.currentTrick.map((p) => ({
      seat: p.seat as Seat,
      card: { suit: p.suit as Suit, rank: p.rank as Rank },
    }));
    const winnerSeat = determineTrickWinner(plays, this.state.trumpSuit as Suit);
    const points = trickPoints(plays.map((p) => p.card));

    if (teamForSeat(winnerSeat) === teamForSeat(this.state.declarerSeat as Seat)) {
      this.declarerPointsCollected += points;
    } else {
      this.defenderPointsCollected += points;
    }

    // The winner scoops the trick face-down onto their team's pile, cards still in the
    // order they were played — led suit first, which is what keeps suits grouped.
    this.teamPiles[teamForSeat(winnerSeat)].push(...plays.map((p) => p.card));

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

    const { declarerDelta, defenderDelta } = resolveHandScore(
      bid,
      this.declarerPointsCollected,
      this.defenderPointsCollected,
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
    this.declarerPointsCollected = 0;
    this.defenderPointsCollected = 0;

    this.state.phase = 'bidding';
    this.state.declarerSeat = -1;
    this.state.winningBidType = '';
    this.state.winningBidAmount = 0;
    this.state.trumpSuit = '';
    this.state.currentTrick.clear();
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
