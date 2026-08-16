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

    this.registerGameMessages();
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
    const allSeated = this.state.players.every((p) => p.sessionId !== '');
    if (!allSeated) return;

    this.startHand();
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
    if (!this.state.players.every((p) => p.sessionId !== '' && p.wantsRematch)) return;

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
