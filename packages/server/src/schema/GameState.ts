import { ArraySchema, Schema, type } from '@colyseus/schema';
import { shelem } from '@shelem/shared';

const { DEFAULT_TABLE_CONFIG } = shelem;
type ShuffleMode = shelem.ShuffleMode;
type SharedTableConfig = shelem.TableConfig;

/** Public per-player info. Actual hand contents are never put in synced state —
 * see ShelemRoom's private hand tracking — only the count is public. */
export class PlayerInfo extends Schema {
  @type('string') sessionId = '';
  @type('string') name = '';
  @type('number') seat = -1;
  @type('boolean') connected = true;
  @type('number') handSize = 0;
  /** Set when this seat has asked for a rematch at the end of a match. Per-seat
   * rather than a count so every client can show who is still to agree. */
  @type('boolean') wantsRematch = false;
}

export class BidRecord extends Schema {
  @type('number') seat = -1;
  @type('string') bidType: 'numeric' | 'shelem' | 'sarShelem' | 'pass' = 'pass';
  @type('number') amount = 0;
}

export class TrickPlay extends Schema {
  @type('number') seat = -1;
  @type('string') suit = '';
  @type('string') rank = '';
}

/** The rules this table is playing under, chosen by whoever created it and then fixed
 * for the whole match. Synced so every seat can see the house rules before the first
 * deal rather than discovering them from the scoreboard. Mirrors the shared
 * TableConfig — see @shelem/shared's config.ts for the bounds each field is held to. */
export class TableConfig extends Schema {
  @type('number') targetScore = DEFAULT_TABLE_CONFIG.targetScore;
  @type('number') shelemValue = DEFAULT_TABLE_CONFIG.shelemValue;
  @type('number') sarShelemValue = DEFAULT_TABLE_CONFIG.sarShelemValue;
  @type('boolean') sarShelemTakesWidow = DEFAULT_TABLE_CONFIG.sarShelemTakesWidow;
  @type('boolean') doubleNegativeEnabled = DEFAULT_TABLE_CONFIG.doubleNegativeEnabled;
  @type('number') doubleNegativeThreshold = DEFAULT_TABLE_CONFIG.doubleNegativeThreshold;
  @type('string') shuffleMode: ShuffleMode = DEFAULT_TABLE_CONFIG.shuffleMode;

  /** Applied field by field rather than by replacing the whole child schema, so
   * clients get a diff of what actually changed. */
  applyConfig(config: SharedTableConfig) {
    this.targetScore = config.targetScore;
    this.shelemValue = config.shelemValue;
    this.sarShelemValue = config.sarShelemValue;
    this.sarShelemTakesWidow = config.sarShelemTakesWidow;
    this.doubleNegativeEnabled = config.doubleNegativeEnabled;
    this.doubleNegativeThreshold = config.doubleNegativeThreshold;
    this.shuffleMode = config.shuffleMode;
    return this;
  }
}

export class SeatSwapRequest extends Schema {
  @type('number') fromSeat = -1;
  @type('number') toSeat = -1;
}

/** One completed hand's scoring, kept so the scoreboard can show how the match
 * got to its current totals rather than only the totals themselves. Carries both
 * the deltas and the running totals after them, so a row reads on its own without
 * the client having to re-accumulate. */
export class HandResult extends Schema {
  @type('number') handNumber = 0;
  @type('number') declarerSeat = -1;
  @type('string') bidType: 'numeric' | 'shelem' | 'sarShelem' = 'numeric';
  @type('number') bidAmount = 0;
  @type('boolean') declarerMadeBid = false;
  @type('number') team0Delta = 0;
  @type('number') team1Delta = 0;
  @type('number') team0Total = 0;
  @type('number') team1Total = 0;
}

export class GameState extends Schema {
  @type([PlayerInfo]) players = new ArraySchema<PlayerInfo>();

  @type('string') phase = 'lobby';
  @type('number') dealerSeat = 0;
  @type('number') currentTurnSeat = -1;
  @type('number') declarerSeat = -1;

  @type([BidRecord]) bidHistory = new ArraySchema<BidRecord>();
  @type('string') winningBidType = '';
  @type('number') winningBidAmount = 0;

  @type('string') trumpSuit = '';
  @type([TrickPlay]) currentTrick = new ArraySchema<TrickPlay>();
  @type('number') tricksPlayedThisHand = 0;

  /** The trick that was just completed, kept after `currentTrick` is cleared so a
   * player can look back at it. Public information — all four players watched
   * those cards land — unlike the team piles, whose *order* must never be synced
   * (see docs/architecture.md). Cleared at the start of each hand. */
  @type([TrickPlay]) lastTrick = new ArraySchema<TrickPlay>();
  @type('number') lastTrickWinnerSeat = -1;
  @type('number') lastTrickPoints = 0;

  @type('number') team0Score = 0;
  @type('number') team1Score = 0;
  @type([HandResult]) handHistory = new ArraySchema<HandResult>();

  /** The rules for this match. Always present, unlike `pendingSeatSwap` below, so it's
   * constructed eagerly and then mutated in place. */
  @type(TableConfig) config = new TableConfig();

  /** Running point totals for the hand in progress — lets players track live
   * progress toward the bid instead of only seeing the match score update at
   * hand-end. Reset to 0 at the start of each hand. */
  @type('number') declarerPointsCollected = 0;
  @type('number') defenderPointsCollected = 0;

  @type(SeatSwapRequest) pendingSeatSwap: SeatSwapRequest | undefined = undefined;

  @type('number') handNumber = 0;

  /** Whoever created the table (first to take a seat). Only they may change the
   * table's settings, and only while it's still in the lobby. Keyed by session id
   * rather than seat so a seat swap doesn't hand the role to someone else. */
  @type('string') hostSessionId = '';
}
