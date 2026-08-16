import { Client } from 'colyseus';
import {
  type Card,
  type Rank,
  type Seat,
  type Suit,
  type Team,
  SUITS,
  createDeck,
  shuffle,
  tableShuffle,
  determineTrickWinner,
  legalCards,
  hokm,
} from '@shelem/shared';
import type { TrickCardPlay } from '@shelem/shared';
import {
  HokmGameState,
  HakemReveal,
  HokmHandResult,
} from '../schema/HokmGameState.js';
import { TrickPlay } from '../schema/BaseGameState.js';
import { BaseTableRoom, cardsEqual, HAND_REVIEW_MS, type JoinOptions } from './BaseTableRoom.js';

type BotView = hokm.BotView;

// Destructured rather than called through the namespace so the room reads as a list
// of rules being applied, not of lookups.
const {
  drawForHakem,
  dealHokm,
  resolveHokmHand,
  nextHakemSeat,
  isHokmMatchComplete,
  validateHokmConfig,
  chooseTrump,
  chooseCard,
  HOKM_TRICKS_TO_WIN,
} = hokm;

/**
 * How fast the face-up cards land during the Hâkem draw. Server-driven so all four
 * seats watch it at the same pace.
 *
 * Kept brisk on purpose. A 52-card deck holds four Aces, so the first one takes
 * ~10.5 cards to turn up on average and occasionally far more — the draw is a
 * geometric-ish wait, not a fixed-length animation. At half a second a card that
 * average is a five-second hold before anyone is dealt anything, and a bad draw is
 * twenty. This is roughly the pace of a real dealer flicking cards round a table.
 */
const HAKEM_REVEAL_MS = 220;
/** A beat after the last card lands before the deal begins, so the Ace that settled
 * it is actually seen rather than flashing past. */
const HAKEM_SETTLE_MS = 1100;

export class HokmRoom extends BaseTableRoom<HokmGameState> {
  // Server-only, never synced: the eight cards per seat still to come once trump is
  // named. Holding them here rather than in `hands` is what keeps the Hâkem's choice
  // honest — nobody, including the Hâkem, can see past their opening five.
  private pendingRest: Card[][] = [[], [], [], []];
  // True during the completed-trick pause, blocking the next lead until resolveTrick runs.
  private resolvingTrick = false;
  // Each team's won tricks, kept for the between-hands shuffle the same way Shelem
  // keeps its piles — see `nextDeck`.
  private teamPiles: [Card[], Card[]] = [[], []];
  private collectedDeck: Card[] | null = null;
  // Every card played this hand, in order, with the seat that played it. Public
  // information — the whole table watched each one land — but the synced state
  // only keeps the current and previous trick, and a bot's void inference needs
  // the lot. Server-side only because nothing on screen wants it.
  private playLog: TrickCardPlay[] = [];

  /** Hokm has bot logic (see takeBotTurn), so a host may seat one. */
  protected botsSupported = true;

  protected createState(options: JoinOptions): HokmGameState {
    const state = new HokmGameState();
    // The create-table screen validates the same config before sending it, so a
    // rejection here means a client that isn't ours — fail the create loudly rather
    // than quietly seating people at a table with rules nobody chose.
    const validated = validateHokmConfig(options.config ?? {});
    if (!validated.ok) throw new Error(`Invalid table settings: ${validated.error}`);
    state.config.applyConfig(validated.config);
    return state;
  }

  protected registerGameMessages() {
    this.onMessage('setTableConfig', (client, message) => this.handleSetTableConfig(client, message));
    this.onMessage('declareTrump', (client, message) => this.handleDeclareTrump(client, message));
    this.onMessage('playCard', (client, message) => this.handlePlayCard(client, message));
  }

  /** The rules are normally settled before the room exists, on the create-table
   * screen. This exists for the other time a table needs them: after a rematch, when
   * the newly drawn host is sent back to that same screen with the room already up.
   *
   * Setting the rules and leaving the configure phase are one message rather than two
   * so they can't come apart: a rejected config that still let the table advance would
   * start the match under rules nobody chose. */
  private handleSetTableConfig(client: Client, message: unknown) {
    if (this.state.phase !== 'configuring') return;
    if (client.sessionId !== this.state.hostSessionId) {
      client.send('actionRejected', { action: 'setTableConfig', reason: 'Only the host can change table settings' });
      return;
    }

    const validated = validateHokmConfig(message);
    if (!validated.ok) {
      client.send('actionRejected', { action: 'setTableConfig', reason: validated.error });
      return;
    }

    this.state.config.applyConfig(validated.config);
    this.state.phase = 'lobby';
  }

  // ---- Finding the Hâkem ----

  /**
   * A hand begins one of two ways. The first hand of a match seats a Hâkem — by the
   * face-up ceremony, or silently on a `random` table — and every hand after that
   * inherits one from how the last hand went (see `completeHand`), so it goes
   * straight to the deal.
   */
  protected startHand() {
    this.resolvingTrick = false;
    this.teamPiles = [[], []];
    this.playLog = [];
    this.state.currentTrick.clear();
    this.state.lastTrick.clear();
    this.state.lastTrickWinnerSeat = -1;
    this.state.team0Tricks = 0;
    this.state.team1Tricks = 0;
    this.state.trumpSuit = '';
    this.state.handNumber += 1;

    if (this.state.hakemSeat >= 0) {
      this.dealHand();
      return;
    }

    this.seatFirstHakem();
  }

  private seatFirstHakem() {
    // The ceremony reads off its own deck and puts nothing aside: at a real table the
    // cards turned face up go straight back in before the deal. `dealHand` shuffles
    // again, so nothing shown here is where it was shown from.
    const draw = drawForHakem(shuffle(createDeck()), this.state.dealerSeat as Seat, this.state.config.hakemSelection);

    this.state.hakemSeat = draw.hakemSeat;
    draw.teamOfSeat.forEach((team, seat) => {
      this.state.teamOfSeat[seat] = team;
    });

    if (draw.reveals.length === 0) {
      this.dealHand();
      return;
    }

    // Pushed one at a time rather than all at once: the draw is something the table
    // watches, and a client handed the finished array has nothing to animate.
    this.state.phase = 'hakemDraw';
    this.state.currentTurnSeat = -1;
    this.state.hakemDraw.clear();

    draw.reveals.forEach((reveal, index) => {
      this.clock.setTimeout(() => {
        const card = new HakemReveal();
        card.seat = reveal.seat;
        card.suit = reveal.card.suit;
        card.rank = reveal.card.rank;
        this.state.hakemDraw.push(card);
      }, HAKEM_REVEAL_MS * (index + 1));
    });

    this.clock.setTimeout(
      () => this.dealHand(),
      HAKEM_REVEAL_MS * draw.reveals.length + HAKEM_SETTLE_MS,
    );
  }

  // ---- Dealing and naming trump ----

  /**
   * The deck for the next deal. A Hokm table starts every hand from a fresh random
   * deck by default — Shelem's light shuffle exists to make long suits reachable for
   * its auction, which Hokm hasn't got. A table can still ask for it.
   */
  private nextDeck(): Card[] {
    const collected = this.collectedDeck;
    this.collectedDeck = null;
    if (this.state.config.shuffleMode === 'random') return shuffle(createDeck());
    if (collected && collected.length === 52) return tableShuffle(collected);
    return shuffle(createDeck());
  }

  /** Five cards each, and then a stop. The remaining eight sit in `pendingRest`
   * until trump is named. */
  private dealHand() {
    const { opening, rest } = dealHokm(this.nextDeck(), this.state.hakemSeat as Seat);
    this.hands = opening;
    this.pendingRest = rest;

    this.state.phase = 'declaringTrump';
    this.state.currentTurnSeat = this.state.hakemSeat;

    for (let seat = 0; seat < 4; seat++) {
      this.sendHand(seat as Seat);
    }
    this.scheduleBotTurn();
  }

  /** A person naming trump. Resolves them to a seat and hands off to the same
   * code a bot goes through — the rules live in one place, not two. */
  private handleDeclareTrump(client: Client, message: { suit?: string }) {
    const seat = this.seatBySessionId.get(client.sessionId);
    if (seat === undefined) return;
    const rejection = this.declareTrump(seat, message.suit as Suit | undefined);
    if (rejection) client.send('actionRejected', { action: 'declareTrump', reason: rejection });
  }

  /** Names trump for a seat, whoever is behind it. Returns a reason when the move
   * is refused, so the caller can decide whether anyone needs telling. */
  private declareTrump(seat: Seat, suit: Suit | undefined): string | null {
    if (this.state.phase !== 'declaringTrump') return null;
    if (seat !== this.state.hakemSeat) return 'Only the Hâkem names trump';
    if (!suit || !SUITS.includes(suit)) return 'Trump must be one of the four suits';

    this.state.trumpSuit = suit;

    for (let s = 0; s < 4; s++) {
      this.hands[s] = this.hands[s].concat(this.pendingRest[s]);
      this.pendingRest[s] = [];
      this.sendHand(s as Seat);
    }

    this.state.phase = 'playing';
    // The Hâkem leads to the first trick — the third of the three privileges.
    this.state.currentTurnSeat = this.state.hakemSeat;
    this.scheduleBotTurn();
    return null;
  }

  // ---- Playing ----

  private handlePlayCard(client: Client, message: { suit?: Suit; rank?: Rank }) {
    const seat = this.seatBySessionId.get(client.sessionId);
    if (seat === undefined) return;
    if (!message.suit || !message.rank) return;
    const rejection = this.playCard(seat, { suit: message.suit, rank: message.rank });
    if (rejection) client.send('actionRejected', { action: 'playCard', reason: rejection });
  }

  /** Plays a card for a seat, whoever is behind it. Returns a reason when the move
   * is refused. A bot reaches this by the same door a person does, so it is held
   * to exactly the same rules rather than a second copy of them. */
  private playCard(seat: Seat, card: Card): string | null {
    if (this.state.phase !== 'playing') return null;
    if (this.resolvingTrick) return null;
    if (seat !== this.state.currentTurnSeat) return null;

    const hand = this.hands[seat];
    const index = hand.findIndex((c) => cardsEqual(c, card));
    if (index === -1) return 'Card not in hand';

    // Unlike Shelem, trump is already known by the time a card is played — the
    // Hâkem named it — so leading carries no special meaning beyond setting the suit.
    if (this.state.currentTrick.length > 0) {
      const leadSuit = this.state.currentTrick[0].suit as Suit;
      const legal = legalCards(hand, leadSuit, this.state.trumpSuit as Suit);
      if (!legal.some((c) => cardsEqual(c, card))) return 'Illegal move';
    }

    hand.splice(index, 1);
    const play = new TrickPlay();
    play.seat = seat;
    play.suit = card.suit;
    play.rank = card.rank;
    this.state.currentTrick.push(play);

    this.sendHand(seat);

    if (this.state.currentTrick.length < 4) {
      this.state.currentTurnSeat = ((seat + 1) % 4) as Seat;
      this.scheduleBotTurn();
      return null;
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
    return null;
  }

  private resolveTrick() {
    const plays = this.state.currentTrick.map((p) => ({
      seat: p.seat as Seat,
      card: { suit: p.suit as Suit, rank: p.rank as Rank },
    }));
    const winnerSeat = determineTrickWinner(plays, this.state.trumpSuit as Suit);
    const winnerTeam = this.teamOf(winnerSeat);

    // Hokm counts tricks, not card points — this is the whole of its scoring.
    if (winnerTeam === 0) this.state.team0Tricks += 1;
    else this.state.team1Tricks += 1;

    this.teamPiles[winnerTeam].push(...plays.map((p) => p.card));
    this.playLog.push(...plays);

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

    this.state.currentTrick.clear();
    this.state.currentTurnSeat = winnerSeat;
    this.scheduleBotTurn();

    // Seven ends it. The remaining six tricks are never played — the hand is already
    // decided, and nothing in the scoring depends on them.
    if (Math.max(this.state.team0Tricks, this.state.team1Tricks) >= HOKM_TRICKS_TO_WIN) {
      this.completeHand();
    }
  }

  private completeHand() {
    const hakemTeam = this.teamOf(this.state.hakemSeat as Seat);
    const { team0Delta, team1Delta, winningTeam, outcome } = resolveHokmHand(
      {
        team0Tricks: this.state.team0Tricks,
        team1Tricks: this.state.team1Tricks,
        hakemTeam,
      },
      this.state.config,
    );

    this.state.team0Score += team0Delta;
    this.state.team1Score += team1Delta;

    // Recorded here, before startHand() below bumps handNumber to the next deal.
    const result = new HokmHandResult();
    result.handNumber = this.state.handNumber;
    result.hakemSeat = this.state.hakemSeat;
    result.trumpSuit = this.state.trumpSuit;
    result.outcome = outcome;
    result.team0Tricks = this.state.team0Tricks;
    result.team1Tricks = this.state.team1Tricks;
    result.team0Delta = team0Delta;
    result.team1Delta = team1Delta;
    result.team0Total = this.state.team0Score;
    result.team1Total = this.state.team1Score;
    this.state.handHistory.push(result);

    const [pile0, pile1] = this.teamPiles;
    this.collectedDeck = Math.random() < 0.5 ? pile0.concat(pile1) : pile1.concat(pile0);

    // The Hâkem keeps the chair on a win and passes it on a loss — the one thing in
    // Hokm that carries between hands.
    this.state.hakemSeat = nextHakemSeat(this.state.hakemSeat, winningTeam === hakemTeam);

    if (
      isHokmMatchComplete(
        { team0: this.state.team0Score, team1: this.state.team1Score },
        this.state.config.targetScore,
      )
    ) {
      this.state.phase = 'matchComplete';
      this.state.currentTurnSeat = -1;
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

  /** Which team a seat plays for. Read from state rather than seat parity because a
   * table set to `aceDealTeams` draws its partnerships from the cards. */
  private teamOf(seat: Seat): Team {
    return this.state.teamOfSeat[seat] as Team;
  }

  // ---- Bots ----

  /**
   * Makes the move this bot owes. Dispatched by phase, because the phase is what
   * decides whether a seat owes a trump call or a card.
   *
   * The decision itself is a pure function in `@shelem/shared` and costs
   * microseconds; everything expensive about a bot is deliberately absent (see
   * hokm/bot.ts). The result goes through `declareTrump`/`playCard`, the same
   * code a person's message reaches, so a bot cannot make a move a person could
   * not — including playing a card it doesn't hold.
   */
  protected takeBotTurn(seat: Seat) {
    if (this.state.phase === 'declaringTrump') {
      this.declareTrump(seat, chooseTrump(this.hands[seat]));
      return;
    }

    if (this.state.phase === 'playing') {
      this.playCard(seat, chooseCard(this.botView(seat)));
    }
  }

  /** What this seat is entitled to know. Assembled from the room's own state and
   * that seat's hand — never from another seat's cards. */
  private botView(seat: Seat): BotView {
    const trick: TrickCardPlay[] = this.state.currentTrick.map((p) => ({
      seat: p.seat as Seat,
      card: { suit: p.suit as Suit, rank: p.rank as Rank },
    }));
    return {
      seat,
      hand: this.hands[seat],
      trick,
      trumpSuit: this.state.trumpSuit as Suit,
      teamOfSeat: [...this.state.teamOfSeat] as Team[],
      played: [...this.playLog, ...trick],
    };
  }

  protected resetGameForRematch() {
    this.state.handHistory.clear();
    this.state.hakemDraw.clear();
    // Cleared so the next match seats a Hâkem from scratch, ceremony and all, rather
    // than inheriting whoever happened to hold the chair when the last one ended.
    this.state.hakemSeat = -1;
    this.state.team0Tricks = 0;
    this.state.team1Tricks = 0;

    this.collectedDeck = null;
    this.teamPiles = [[], []];
    this.playLog = [];
    this.pendingRest = [[], [], [], []];
    this.resolvingTrick = false;
  }
}
