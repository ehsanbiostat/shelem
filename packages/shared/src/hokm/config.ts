import type { ShuffleMode } from '../core/types.js';

/**
 * How the Hâkem — and, on one setting, the partnerships themselves — are decided
 * at the start of a match.
 *
 * - `aceDealTeams` — cards go face-up around the table until an Ace appears; that
 *   player is Hâkem, and dealing continues to a second Ace to find their partner.
 *   The traditional way, and the only one where partnerships come from the cards
 *   rather than the seating.
 * - `aceDealSeats` — the same ceremony finds the Hâkem, but partners stay whoever
 *   is sitting opposite. The default: it keeps the ritual without overriding the
 *   seats players deliberately arranged in the lobby.
 * - `random` — no ceremony; the server picks a Hâkem and the hand begins.
 */
export type HakemSelection = 'aceDealTeams' | 'aceDealSeats' | 'random';

/**
 * The rules a Hokm table is played under, chosen by whoever creates it and then
 * fixed for the whole match. Unlike Shelem, whose numbers are pinned to the 165
 * points in a hand, Hokm's scoring is a small ladder of independent values that
 * groups genuinely set differently — so nearly all of it is here.
 */
export interface HokmTableConfig {
  /** Points a team must reach to win the match. */
  targetScore: number;
  /** What winning a hand is worth when the losers took at least one trick. */
  handValue: number;
  /** Kot: the Hâkem's team takes the first seven tricks, opponents none. */
  kotValue: number;
  /** Hâkem Koti: the opponents do that to the Hâkem. Traditionally the dearest
   * result on the table, which is the point of it. */
  hakemKotiValue: number;
  hakemSelection: HakemSelection;
  shuffleMode: ShuffleMode;
}

/** The traditional ruleset, as documented in docs/game-rules-hokm.md. */
export const DEFAULT_HOKM_CONFIG: HokmTableConfig = {
  targetScore: 7,
  handValue: 1,
  kotValue: 2,
  hakemKotiValue: 3,
  hakemSelection: 'aceDealSeats',
  // Not `table`, which is Shelem's default. That light shuffle exists to keep suits
  // grouped so a trump-length bid stays reachable; Hokm has no auction, so the
  // justification doesn't carry over. It stays available because a long suit still
  // helps a Hâkem choose.
  shuffleMode: 'random',
};

/** Handy match lengths offered on the create-table screen. Shortcuts only — any
 * whole number in range is accepted. */
export const HOKM_TARGET_PRESETS = [
  { label: 'Quick', targetScore: 3 },
  { label: 'Mid', targetScore: 5 },
  { label: 'Standard', targetScore: DEFAULT_HOKM_CONFIG.targetScore },
] as const;

/** One hand is the floor, below which there'd be no match to speak of; the ceiling
 * only stops a typo producing a table nobody can finish. */
export const MIN_HOKM_TARGET = 1;
export const MAX_HOKM_TARGET = 100;

/** Every rung of the ladder is a score, so the same bounds hold for all three. */
export const MIN_HOKM_VALUE = 1;
export const MAX_HOKM_VALUE = 100;

export type HokmValidationResult =
  | { ok: true; config: HokmTableConfig }
  | { ok: false; error: string };

function isWholeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

/**
 * Checks a config coming off the wire and returns it fully populated, filling any
 * missing field from the defaults. The server is the authority and calls this before
 * accepting anything; the create-table screen calls the same function so the host sees
 * the same verdict while typing rather than after submitting.
 */
export function validateHokmConfig(input: unknown): HokmValidationResult {
  if (typeof input !== 'object' || input === null) {
    return { ok: false, error: 'Table settings must be an object' };
  }

  const config: HokmTableConfig = { ...DEFAULT_HOKM_CONFIG, ...(input as Partial<HokmTableConfig>) };

  if (!isWholeNumber(config.targetScore) || config.targetScore < MIN_HOKM_TARGET || config.targetScore > MAX_HOKM_TARGET) {
    return {
      ok: false,
      error: `Target score must be a whole number between ${MIN_HOKM_TARGET} and ${MAX_HOKM_TARGET}`,
    };
  }

  for (const [label, value] of [
    ['A won hand', config.handValue],
    ['Kot', config.kotValue],
    ['Hâkem Koti', config.hakemKotiValue],
  ] as const) {
    if (!isWholeNumber(value) || value < MIN_HOKM_VALUE || value > MAX_HOKM_VALUE) {
      return {
        ok: false,
        error: `${label} must be worth a whole number between ${MIN_HOKM_VALUE} and ${MAX_HOKM_VALUE}`,
      };
    }
  }

  // The ladder has to actually climb. A Kot is a won hand with the opponents shut
  // out, and a Hâkem Koti is that same sweep against the player who chose trump —
  // each strictly harder than the last, so a table that priced them the other way
  // round would be rewarding the lesser result.
  if (config.kotValue < config.handValue) {
    return { ok: false, error: 'A Kot is a won hand with the opponents shut out, so it cannot be worth less' };
  }
  if (config.hakemKotiValue < config.kotValue) {
    return { ok: false, error: 'A Hâkem Koti is the harder sweep, so it cannot be worth less than a Kot' };
  }

  if (
    config.hakemSelection !== 'aceDealTeams' &&
    config.hakemSelection !== 'aceDealSeats' &&
    config.hakemSelection !== 'random'
  ) {
    return { ok: false, error: 'Hâkem selection must be aceDealTeams, aceDealSeats or random' };
  }

  if (config.shuffleMode !== 'table' && config.shuffleMode !== 'random') {
    return { ok: false, error: 'Shuffle mode must be either table or random' };
  }

  return { ok: true, config };
}
