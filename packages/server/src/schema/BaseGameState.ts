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
   * Shelem fills this from `teamForSeat` and never touches it again — partners are
   * whoever sits opposite, which is what the lobby's seat swap is for. It is state
   * rather than a derivation because Hokm can be configured to draw partnerships
   * from the cards (see `hakemSelection: 'aceDealTeams'`), and a client rendering
   * the scoreboard has to be told which pairing it is looking at rather than
   * assuming seat parity.
   */
  @type(['number']) teamOfSeat = new ArraySchema<number>();

  @type(SeatSwapRequest) pendingSeatSwap: SeatSwapRequest | undefined = undefined;

  @type('number') handNumber = 0;

  /** Whoever created the table (first to take a seat). Only they may change the
   * table's settings, and only while it's still being configured. Keyed by session
   * id rather than seat so a seat swap doesn't hand the role to someone else. */
  @type('string') hostSessionId = '';
}
