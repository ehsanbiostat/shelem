import { ArraySchema, Schema, type } from '@colyseus/schema';
import { shelem } from '@shelem/shared';
import { BaseGameState } from './BaseGameState.js';

const { DEFAULT_TABLE_CONFIG } = shelem;
type ShuffleMode = shelem.ShuffleMode;
type SharedTableConfig = shelem.TableConfig;

export { PlayerInfo, SeatSwapRequest, TrickPlay } from './BaseGameState.js';

export class BidRecord extends Schema {
  @type('number') seat = -1;
  @type('string') bidType: 'numeric' | 'shelem' | 'sarShelem' | 'pass' = 'pass';
  @type('number') amount = 0;
}

/** The rules this table is playing under, chosen by whoever created it and then fixed
 * for the whole match. Synced so every seat can see the house rules before the first
 * deal rather than discovering them from the scoreboard. Mirrors the shared
 * TableConfig — see @shelem/shared's shelem/config.ts for the bounds each field is
 * held to. */
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

/** Shelem's state: the shared table (see BaseGameState) plus its auction, its
 * widow, and the running card-point totals its scoring is built on. */
export class GameState extends BaseGameState {
  @type('number') declarerSeat = -1;

  @type([BidRecord]) bidHistory = new ArraySchema<BidRecord>();
  @type('string') winningBidType = '';
  @type('number') winningBidAmount = 0;

  @type('number') tricksPlayedThisHand = 0;
  @type('number') lastTrickPoints = 0;

  @type([HandResult]) handHistory = new ArraySchema<HandResult>();

  /** The rules for this match. Always present, unlike `pendingSeatSwap`, so it's
   * constructed eagerly and then mutated in place. */
  @type(TableConfig) config = new TableConfig();

  /** Running point totals for the hand in progress — lets players track live
   * progress toward the bid instead of only seeing the match score update at
   * hand-end. Reset to 0 at the start of each hand. */
  @type('number') declarerPointsCollected = 0;
  @type('number') defenderPointsCollected = 0;
}
