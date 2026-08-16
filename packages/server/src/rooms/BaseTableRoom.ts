import { Room, Client, matchMaker } from 'colyseus';
import { type Card, type Seat, teamForSeat } from '@shelem/shared';
import { PlayerInfo, SeatSwapRequest, type BaseGameState } from '../schema/BaseGameState.js';

export interface JoinOptions {
  name?: string;
  /** The table's rules, sent by the create-table screen. Validated by the game's own
   * config validator; anything missing falls back to that game's default ruleset. */
  config?: unknown;
}

/** How long the completed hand's scores stay up before the next one is dealt.
 * Server-driven so all four players get the same pause at the same moment. */
export const HAND_REVIEW_MS = 5000;

/** Room codes get read aloud and typed in by hand, so the alphabet leaves out the
 * pairs that get confused when spoken or squinted at: I/1, L/1, O/0. Four
 * characters from the remaining 31 is ~920k codes, which is far more than a
 * private-table game will ever hold open at once, and short enough to say down a
 * phone line in one go. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 4;

/** Four characters collide often enough to matter, so this checks the codes
 * actually in use rather than trusting randomness. The attempt cap means a
 * pathologically full server fails loudly instead of spinning forever. */
async function generateRoomCode(): Promise<string> {
  const taken = new Set((await matchMaker.query({})).map((room) => room.roomId));
  for (let attempt = 0; attempt < 100; attempt++) {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    if (!taken.has(code)) return code;
  }
  throw new Error('Could not allocate a free room code');
}

export function cardsEqual(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

/**
 * A seat has somebody in it — a human who joined, or a bot.
 *
 * Every occupancy test used to read `sessionId !== ''`, which a bot can never
 * satisfy because it never connects. This is the one place that distinction is
 * made, so a table of one human and three bots counts as full everywhere it
 * needs to.
 */
export function isOccupied(player: PlayerInfo): boolean {
  return player.sessionId !== '' || player.isBot;
}

/** How many bots a table will take. Three, because the fourth seat is what the
 * bots are there to play against — a table with no people in it has nobody to
 * play for. */
export const MAX_BOTS = 3;

/** How long a bot appears to think before acting. Randomised so a table of bots
 * doesn't move in lockstep, and long enough that a human can follow what
 * happened — the point is pacing, not computation. The decision itself takes
 * well under a millisecond (see hokm/bot.ts); this is the wait, not the work. */
const BOT_THINK_MIN_MS = 500;
const BOT_THINK_MAX_MS = 1400;

/**
 * The half of a table that has nothing to do with which game is played on it: the
 * room code, who sits where, who hosts, swapping seats before the deal, holding a
 * seat open for a player who dropped, and agreeing to play again.
 *
 * A game subclasses this and supplies its own state schema, its own config
 * validation, and what happens when a hand starts — see ShelemRoom and HokmRoom.
 * Colyseus's own room registry is the game registry (`gameServer.define`), which
 * is why adding a game needs no framework beyond this class.
 *
 * Hidden information is handled here too, and deliberately: `hands` is a plain
 * field rather than synced schema, and reaches a player only through the private
 * `hand` message in `sendHand`. Anything a subclass puts in `this.state` is public
 * to all four seats.
 */
export abstract class BaseTableRoom<TState extends BaseGameState> extends Room<TState> {
  maxClients = 4;

  /** Server-only, never synced: actual hand contents, hidden until legitimately revealed. */
  protected hands: Card[][] = [[], [], [], []];
  protected seatBySessionId = new Map<string, Seat>();

  /** The game's own initial state, already carrying whatever config the creator
   * chose. Throwing from here refuses the table outright, which is the right
   * answer for rules that don't validate — better than seating four people at a
   * table playing rules nobody picked. */
  protected abstract createState(options: JoinOptions): TState;

  /** Where the game registers its own message handlers. The table's own —
   * startGame, playAgain, seat swap — are already registered. */
  protected abstract registerGameMessages(): void;

  /** Deal and begin a hand. Called when the table starts, and again by the game
   * itself between hands. */
  protected abstract startHand(): void;

  /** Put the game's own state back to a fresh match. The table's part of the reset
   * — scores, host, rematch votes, phase — is handled by `resetForRematch` below. */
  protected abstract resetGameForRematch(): void;

  /**
   * Whether this game can actually play a bot's turn. Off by default so a game
   * without bot logic can't be given one and then sit there waiting for a move
   * that will never come — a bot at a table that can't drive it is worse than no
   * bot at all.
   */
  protected botsSupported = false;

  /**
   * Make the move this bot owes right now. Only the game knows what that is — a
   * Shelem bid, a Hokm trump call, a card — so only the game can dispatch it.
   *
   * Implementations must route the decision through the same handler a human's
   * message reaches, so a bot cannot make a move a person could not: the
   * validation is the same code, not a copy of it.
   */
  protected takeBotTurn(_seat: Seat): void {
    // Games that set botsSupported override this; nothing else can reach it.
  }

  /**
   * The seat whose think-timer is currently pending, so a burst of state changes
   * can't queue the same bot twice.
   *
   * A seat rather than a boolean, and that distinction is load-bearing: a plain
   * flag also blocked the *next* seat from being scheduled, so a trick resolving
   * while some earlier timer was still outstanding left the table frozen with a
   * bot to play and nothing due to wake it.
   */
  private botTurnPendingFor: Seat | null = null;

  /** How long a bot pauses before acting, as [min, max] ms. A field rather than a
   * constant so tests can turn the pacing down — at a realistic delay a single
   * hand takes the better part of a minute, which is right at a table and useless
   * in a test suite. */
  protected botThinkMs: [number, number] = [BOT_THINK_MIN_MS, BOT_THINK_MAX_MS];

  /**
   * Wake the bot whose turn it is, if it is a bot's turn. Games call this after
   * anything that hands the turn on.
   *
   * The delay is `this.clock`, not a bare setTimeout, so it dies with the room
   * rather than firing into a disposed table. On waking it re-checks that the
   * turn is *still* this bot's and that the phase hasn't moved — a reconnect, a
   * rematch or a hand ending can all overtake a pending think.
   */
  protected scheduleBotTurn() {
    const seat = this.state.currentTurnSeat as Seat;
    if (seat < 0 || !this.state.players[seat]?.isBot) return;
    if (this.botTurnPendingFor === seat) return;

    const phase = this.state.phase;
    const hand = this.state.handNumber;
    this.botTurnPendingFor = seat;
    const [minMs, maxMs] = this.botThinkMs;
    const delay = minMs + Math.random() * (maxMs - minMs);

    this.clock.setTimeout(() => {
      if (this.botTurnPendingFor === seat) this.botTurnPendingFor = null;
      // The table can move on underneath a pending think — a hand ending, a
      // rematch, a reconnect — so nothing is assumed to still be true.
      if (this.state.phase !== phase || this.state.handNumber !== hand) return;
      if (this.state.currentTurnSeat !== seat) return;
      if (!this.state.players[seat]?.isBot) return;

      // Whatever this does hands the turn on, and the game schedules the next bot
      // from the same place it would tell a human it was their go. Re-scheduling
      // from here as well would double-drive the table.
      this.takeBotTurn(seat);
    }, delay);
  }

  async onCreate(options: JoinOptions) {
    this.roomId = await generateRoomCode();

    const state = this.createState(options);
    for (let seat = 0; seat < 4; seat++) {
      const player = new PlayerInfo();
      player.seat = seat;
      state.players.push(player);
      state.teamOfSeat.push(teamForSeat(seat as Seat));
    }
    this.state = state;

    this.onMessage('startGame', (client) => this.handleStartGame(client));
    this.onMessage('playAgain', (client) => this.handlePlayAgain(client));
    this.onMessage('requestSeatSwap', (client, message) => this.handleRequestSeatSwap(client, message));
    this.onMessage('respondSeatSwap', (client, message) => this.handleRespondSeatSwap(client, message));
    this.onMessage('addBot', (client, message) => this.handleAddBot(client, message));
    this.onMessage('removeBot', (client, message) => this.handleRemoveBot(client, message));

    this.registerGameMessages();
  }

  onJoin(client: Client, options: JoinOptions) {
    // A genuinely empty seat first; failing that, a bot's — so a host can fill up
    // with bots to get started and a friend arriving late still gets in, rather
    // than being turned away from a table that is only notionally full. Only
    // while the table is still in the lobby: once cards are out, a bot is holding
    // a hand and cannot simply be handed over.
    let seat = this.state.players.findIndex((p) => !isOccupied(p));
    if (seat === -1 && this.state.phase === 'lobby') {
      seat = this.state.players.findIndex((p) => p.isBot);
    }
    if (seat === -1) {
      throw new Error('Table is full');
    }

    const player = this.state.players[seat];
    player.isBot = false;
    player.sessionId = client.sessionId;
    player.name = options.name?.trim() || `Player ${seat + 1}`;
    player.connected = true;
    this.seatBySessionId.set(client.sessionId, seat as Seat);

    // First player to sit down is whoever created the table, and becomes host.
    if (this.state.hostSessionId === '') {
      this.state.hostSessionId = client.sessionId;
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

  /** Filling the last seat only makes the table ready — it doesn't deal. Any seated
   * player can then kick off the first hand once everyone's actually ready to play,
   * rather than the room dealing out from under a player who just joined. */
  private handleStartGame(client: Client) {
    if (this.state.phase !== 'lobby') return;
    if (!this.seatBySessionId.has(client.sessionId)) return;
    const allSeated = this.state.players.every(isOccupied);
    if (!allSeated) return;

    this.startHand();
  }

  /** Seats a bot. Host-only and lobby-only, for the same reason the table's rules
   * are: setting the table up belongs to whoever made it. */
  private handleAddBot(client: Client, message: { seat?: number }) {
    if (this.state.phase !== 'lobby') return;
    if (!this.botsSupported) {
      client.send('actionRejected', { action: 'addBot', reason: 'This game does not have bots yet' });
      return;
    }
    if (client.sessionId !== this.state.hostSessionId) {
      client.send('actionRejected', { action: 'addBot', reason: 'Only the host can add bots' });
      return;
    }
    if (typeof message.seat !== 'number' || message.seat < 0 || message.seat > 3) return;

    const player = this.state.players[message.seat];
    if (isOccupied(player)) return;
    if (this.state.players.filter((p) => p.isBot).length >= MAX_BOTS) {
      client.send('actionRejected', { action: 'addBot', reason: `A table takes at most ${MAX_BOTS} bots` });
      return;
    }

    player.isBot = true;
    // Numbered by seat rather than by how many bots there are, so a bot's name is
    // stable when another is removed from beside it.
    player.name = `Bot ${message.seat + 1}`;
    player.connected = true;
  }

  private handleRemoveBot(client: Client, message: { seat?: number }) {
    if (this.state.phase !== 'lobby') return;
    if (client.sessionId !== this.state.hostSessionId) return;
    if (typeof message.seat !== 'number' || message.seat < 0 || message.seat > 3) return;

    const player = this.state.players[message.seat];
    if (!player.isBot) return;

    player.isBot = false;
    player.name = '';
    player.connected = true;
  }

  /** A rematch needs every seat, including any that are currently disconnected —
   * a player who drops mid-match shouldn't have the table restarted without them.
   * Votes are one-way for the same reason: this is agreement to play on, and
   * letting someone withdraw turns it into a thing to keep re-checking. */
  private handlePlayAgain(client: Client) {
    if (this.state.phase !== 'matchComplete') return;
    const seat = this.seatBySessionId.get(client.sessionId);
    if (seat === undefined) return;

    this.state.players[seat].wantsRematch = true;
    // A bot has no opinion about playing again, so waiting on one would mean a
    // table of bots could never start a second match. Every *person* still has to
    // agree, which is the point of the vote.
    if (!this.state.players.every((p) => p.isBot || (p.sessionId !== '' && p.wantsRematch))) return;

    this.resetForRematch();
  }

  /** Back to the same people in the same seats — they can still swap in the lobby if
   * they want, which is why seating isn't reshuffled here. The rules of the finished
   * match carry over as the starting point for the new host's configure screen. */
  private resetForRematch() {
    this.state.team0Score = 0;
    this.state.team1Score = 0;
    this.state.handNumber = 0;
    this.state.trumpSuit = '';
    this.state.currentTrick.clear();
    this.state.lastTrick.clear();
    this.state.lastTrickWinnerSeat = -1;
    this.state.currentTurnSeat = -1;
    this.state.players.forEach((p) => (p.wantsRematch = false));

    this.resetGameForRematch();

    // A new match gets a new host, drawn at random from the seated players, so
    // the same person doesn't own the settings match after match.
    const seated = this.state.players.filter((p) => p.sessionId !== '');
    this.state.hostSessionId = seated[Math.floor(Math.random() * seated.length)].sessionId;

    // Rules are fixed for the length of a match, so a new match is the one moment they
    // can change: the new host goes back through the configure screen while the other
    // three wait, and only then does the table drop into the lobby.
    this.state.phase = 'configuring';
  }

  // ---- Seat swap (lobby only) ----

  private handleRequestSeatSwap(client: Client, message: { toSeat?: number }) {
    if (this.state.phase !== 'lobby') return;
    const fromSeat = this.seatBySessionId.get(client.sessionId);
    if (fromSeat === undefined || typeof message.toSeat !== 'number') return;
    if (message.toSeat < 0 || message.toSeat > 3 || message.toSeat === fromSeat) return;
    // Only with another person. A bot has no preference about where it sits, and
    // "swapping" with one is really just moving seats — which the host can do by
    // removing the bot and re-adding it elsewhere.
    const target = this.state.players[message.toSeat];
    if (target.sessionId === '' || target.isBot) return;

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

  // ---- Shared helpers ----

  protected clientFor(seat: Seat): Client | undefined {
    const sessionId = this.state.players[seat].sessionId;
    return sessionId ? this.clients.find((c) => c.sessionId === sessionId) : undefined;
  }

  /** The one channel a player's own cards travel down. Deliberately a message
   * rather than synced state — see the note on `hands`. */
  protected sendHand(seat: Seat) {
    const player = this.state.players[seat];
    player.handSize = this.hands[seat].length;
    if (!player.sessionId) return;
    this.clientFor(seat)?.send('hand', this.hands[seat]);
  }
}
