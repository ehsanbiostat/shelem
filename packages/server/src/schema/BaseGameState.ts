import { ArraySchema, Schema, type } from '@colyseus/schema';

/** Public per-player info. Actual hand contents are never put in synced state —
 * see BaseTableRoom's private hand tracking — only the count is public. */
export class PlayerInfo extends Schema {
  @type('string') sessionId = '';
  @type('string') name = '';
  @type('number') seat = -1;
  @type('boolean') connected = true;
  @type('number') handSize = 0;
  /** Set when this seat has asked for a rematch at the end of a match. Per-seat
   * rather than a count so every client can show who is still to agree. */
  @type('boolean') wantsRematch = false;
  /**
   * This seat is played by the server rather than by a person.
   *
   * A bot has no `sessionId` — it never connects — so this is the only thing that
   * distinguishes an occupied bot seat from an empty one. Synced because a player
   * is entitled to know which of the other three are people: bots are named and
   * marked as bots rather than passed off as human.
   */
  @type('boolean') isBot = false;
}

export class TrickPlay extends Schema {
  @type('number') seat = -1;
  @type('string') suit = '';
  @type('string') rank = '';
}

export class SeatSwapRequest extends Schema {
  @type('number') fromSeat = -1;
  @type('number') toSeat = -1;
}

/**
 * Everything a table has regardless of which game is being played on it: who is
 * sitting where, whose turn it is, the trick on the felt, the match score, and
 * the bits of lobby machinery (host, seat swap, rematch) that work the same way
 * for every game.
 *
 * Each game extends this with its own state — Shelem's auction and widow, Hokm's
 * Hâkem and trick counts — rather than one schema carrying the union of both. A
 * Colyseus schema can't be shaped conditionally, so a shared schema would mean
 * every Shelem client syncing fields that only mean something in Hokm.
 */
export class BaseGameState extends Schema {
  @type([PlayerInfo]) players = new ArraySchema<PlayerInfo>();

  @type('string') phase = 'lobby';
  @type('number') dealerSeat = 0;
  @type('number') currentTurnSeat = -1;

  @type('string') trumpSuit = '';
  @type([TrickPlay]) currentTrick = new ArraySchema<TrickPlay>();

  /** The trick that was just completed, kept after `currentTrick` is cleared so a
   * player can look back at it. Public information — all four players watched
   * those cards land — unlike the team piles, whose *order* must never be synced
   * (see docs/architecture.md). Cleared at the start of each hand. */
  @type([TrickPlay]) lastTrick = new ArraySchema<TrickPlay>();
  @type('number') lastTrickWinnerSeat = -1;

  @type('number') team0Score = 0;
  @type('number') team1Score = 0;

  /**
   * Which team each seat belongs to, by seat index.
   *
   * Partners are always whoever sits opposite, so in practice this is seat parity
   * — Hokm's `aceDealTeams` decides the *pairing* from the cards, but then reseats
   * those two players facing each other rather than leaving them where they were
   * (see HokmRoom.seatPartnerOpposite). It stays explicit state so the server
   * remains the single place that decides it, and so the client can render teams
   * without keeping its own copy of the parity rule.
   */
  @type(['number']) teamOfSeat = new ArraySchema<number>();

  @type(SeatSwapRequest) pendingSeatSwap: SeatSwapRequest | undefined = undefined;

  @type('number') handNumber = 0;

  /**
   * When the current turn expires, as server epoch ms. 0 when no clock is running
   * — no limit set, nobody to act, or a bot's seat.
   *
   * A deadline rather than a ticking number, deliberately. Syncing a countdown
   * would push a patch a second per table to every client for no information they
   * can't derive themselves; the client draws it with requestAnimationFrame from
   * this one value, and the server alone decides when it has passed.
   */
  @type('number') turnEndsAt = 0;
  /** How long this turn was given, in ms, so the client can draw the countdown as
   * a proportion rather than guessing what "full" looks like. */
  @type('number') turnLimitMs = 0;

  /** Whoever created the table (first to take a seat). Only they may change the
   * table's settings, and only while it's still being configured. Keyed by session
   * id rather than seat so a seat swap doesn't hand the role to someone else. */
  @type('string') hostSessionId = '';
}
