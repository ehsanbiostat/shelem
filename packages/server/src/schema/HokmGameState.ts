import { ArraySchema, Schema, type } from '@colyseus/schema';
import { hokm, type ShuffleMode } from '@shelem/shared';
import { BaseGameState } from './BaseGameState.js';

const { DEFAULT_HOKM_CONFIG } = hokm;
type HakemSelection = hokm.HakemSelection;
type SharedHokmConfig = hokm.HokmTableConfig;

/** One card turned face up during the Hâkem draw. Public by nature — the whole
 * point of the ceremony is that everyone watches it happen. */
export class HakemReveal extends Schema {
  @type('number') seat = -1;
  @type('string') suit = '';
  @type('string') rank = '';
  /** Who was sitting there when this card turned up, captured at the time.
   *
   * Not looked up from the seat later, because the draw can *move* people: on
   * `aceDealTeams` the partner is reseated opposite the Hâkem once both Aces are
   * out, and a seat-based lookup would then credit these cards to whoever ended up
   * in that chair. */
  @type('string') name = '';
}

/** The rules this Hokm table is playing under, chosen by whoever created it and then
 * fixed for the whole match. Mirrors the shared HokmTableConfig — see @shelem/shared's
 * hokm/config.ts for the bounds each field is held to. */
export class HokmTableConfig extends Schema {
  @type('number') targetScore = DEFAULT_HOKM_CONFIG.targetScore;
  @type('number') handValue = DEFAULT_HOKM_CONFIG.handValue;
  @type('number') kotValue = DEFAULT_HOKM_CONFIG.kotValue;
  @type('number') hakemKotiValue = DEFAULT_HOKM_CONFIG.hakemKotiValue;
  @type('string') hakemSelection: HakemSelection = DEFAULT_HOKM_CONFIG.hakemSelection;
  @type('string') shuffleMode: ShuffleMode = DEFAULT_HOKM_CONFIG.shuffleMode;

  /** Applied field by field rather than by replacing the whole child schema, so
   * clients get a diff of what actually changed. */
  applyConfig(config: SharedHokmConfig) {
    this.targetScore = config.targetScore;
    this.handValue = config.handValue;
    this.kotValue = config.kotValue;
    this.hakemKotiValue = config.hakemKotiValue;
    this.hakemSelection = config.hakemSelection;
    this.shuffleMode = config.shuffleMode;
    return this;
  }
}

/** One completed hand, kept so the scoreboard can show how the match got to its
 * totals. Carries the deltas and the running totals after them, so a row reads on
 * its own without the client re-accumulating. */
export class HokmHandResult extends Schema {
  @type('number') handNumber = 0;
  @type('number') hakemSeat = -1;
  @type('string') trumpSuit = '';
  /** 'normal' | 'kot' | 'hakemKoti' — see hokm/types.ts. */
  @type('string') outcome = 'normal';
  @type('number') team0Tricks = 0;
  @type('number') team1Tricks = 0;
  @type('number') team0Delta = 0;
  @type('number') team1Delta = 0;
  @type('number') team0Total = 0;
  @type('number') team1Total = 0;
}

/** Hokm's state: the shared table (see BaseGameState) plus the Hâkem, the running
 * trick counts a hand is decided on, and the face-up draw that seats the Hâkem. */
export class HokmGameState extends BaseGameState {
  @type('number') hakemSeat = -1;

  @type('number') team0Tricks = 0;
  @type('number') team1Tricks = 0;

  /** The face-up cards of the Hâkem draw, pushed one at a time so every seat
   * watches the same ceremony at the same pace. Empty on a table that skips it. */
  @type([HakemReveal]) hakemDraw = new ArraySchema<HakemReveal>();

  /** The two seats that changed places so the Aces' partnership could sit opposite
   * each other, or -1 when nobody moved. Two players' view of the table rotates at
   * that moment, so it is worth saying why rather than letting it look like a
   * glitch. After the swap these seats hold exactly the two who moved, so the
   * client can name them itself. */
  @type('number') swappedSeatA = -1;
  @type('number') swappedSeatB = -1;

  @type([HokmHandResult]) handHistory = new ArraySchema<HokmHandResult>();

  @type(HokmTableConfig) config = new HokmTableConfig();
}
