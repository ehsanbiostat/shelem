import type { ShuffleMode } from '../core/types.js';
import { BID_CAP, BID_FLOOR } from './bidding.js';
import { DOUBLE_NEGATIVE_THRESHOLD, SLAM_STAKE, TOTAL_HAND_POINTS } from './scoring.js';

export type { ShuffleMode };

/**
 * The rules a table is played under, chosen by whoever creates it and then fixed for
 * the whole match. Everything here is a house rule that groups genuinely disagree
 * about; the rest of the ruleset (bid floor/cap/increment, card point values, the
 * 165 points in a hand) is fixed, because those numbers are load-bearing for each
 * other — see the bounds below.
 */
export interface TableConfig {
  /** Points a team must reach to win the match. */
  targetScore: number;
  /** What a Shelem pays, won or lost. */
  shelemValue: number;
  /** What a Sar-Shelem pays, won or lost. Traditionally the same as Shelem. */
  sarShelemValue: number;
  /** When true, a Sar-Shelem declarer exchanges the widow like any other contract
   * instead of having it buried for them unchosen. */
  sarShelemTakesWidow: boolean;
  /** When false, a failed contract always costs single stake, however badly it failed. */
  doubleNegativeEnabled: boolean;
  /** Collect fewer points than this on a failed contract and the loss doubles. */
  doubleNegativeThreshold: number;
  shuffleMode: ShuffleMode;
}

/** The traditional ruleset, as documented in docs/game-rules.md. */
export const DEFAULT_TABLE_CONFIG: TableConfig = {
  targetScore: 1165,
  shelemValue: SLAM_STAKE,
  sarShelemValue: SLAM_STAKE,
  sarShelemTakesWidow: false,
  doubleNegativeEnabled: true,
  doubleNegativeThreshold: DOUBLE_NEGATIVE_THRESHOLD,
  shuffleMode: 'table',
};

/** Handy match lengths offered on the create-table screen. 330 is a single Shelem,
 * 660 two, and 1165 the standard match. They're shortcuts only — any whole number
 * in range is accepted. */
export const TARGET_SCORE_PRESETS = [
  { label: 'Quick', targetScore: 330 },
  { label: 'Mid', targetScore: 660 },
  { label: 'Standard', targetScore: DEFAULT_TABLE_CONFIG.targetScore },
] as const;

/** The floor is one hand's worth of points, below which a match would be settled by a
 * single deal; the ceiling only keeps a typo from producing a table nobody can finish.
 * Deliberately not restricted to multiples of 5, even though every score in the game is
 * one: a target of 1234 is perfectly playable — a team simply crosses it. */
export const MIN_TARGET_SCORE = TOTAL_HAND_POINTS;
export const MAX_TARGET_SCORE = 100000;

/** Slam stakes are scores like any other, so they move in fives, and both must outpay
 * the highest numeric bid — a slam outranks every numeric bid in the auction, so being
 * worth less than one would make the ladder incoherent. */
export const MIN_SLAM_VALUE = BID_CAP + 5;
export const MAX_SLAM_VALUE = 10000;

export type ValidationResult =
  | { ok: true; config: TableConfig }
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
export function validateTableConfig(input: unknown): ValidationResult {
  if (typeof input !== 'object' || input === null) {
    return { ok: false, error: 'Table settings must be an object' };
  }

  const config: TableConfig = { ...DEFAULT_TABLE_CONFIG, ...(input as Partial<TableConfig>) };

  if (!isWholeNumber(config.targetScore) || config.targetScore < MIN_TARGET_SCORE || config.targetScore > MAX_TARGET_SCORE) {
    return {
      ok: false,
      error: `Target score must be a whole number between ${MIN_TARGET_SCORE} and ${MAX_TARGET_SCORE}`,
    };
  }

  for (const [label, value] of [
    ['Shelem', config.shelemValue],
    ['Sar-Shelem', config.sarShelemValue],
  ] as const) {
    if (!isWholeNumber(value) || value < MIN_SLAM_VALUE || value > MAX_SLAM_VALUE) {
      return {
        ok: false,
        error: `${label} must be a whole number between ${MIN_SLAM_VALUE} and ${MAX_SLAM_VALUE}`,
      };
    }
    if (value % 5 !== 0) {
      return { ok: false, error: `${label} must be a multiple of 5` };
    }
  }

  if (config.sarShelemValue < config.shelemValue) {
    return { ok: false, error: 'Sar-Shelem outranks Shelem in the bidding, so it cannot be worth less' };
  }

  if (typeof config.sarShelemTakesWidow !== 'boolean') {
    return { ok: false, error: 'Sar-Shelem widow exchange must be on or off' };
  }

  if (typeof config.doubleNegativeEnabled !== 'boolean') {
    return { ok: false, error: 'Double-negative penalty must be on or off' };
  }

  // Capped at the bid floor so the double can never collide with a made contract:
  // the smallest numeric bid that can be made is BID_FLOOR points, so anything under
  // this threshold has failed by definition. See resolveHandScore.
  if (
    !isWholeNumber(config.doubleNegativeThreshold) ||
    config.doubleNegativeThreshold < 0 ||
    config.doubleNegativeThreshold > BID_FLOOR
  ) {
    return {
      ok: false,
      error: `Double-negative threshold must be a whole number between 0 and ${BID_FLOOR}`,
    };
  }

  if (config.shuffleMode !== 'table' && config.shuffleMode !== 'random') {
    return { ok: false, error: 'Shuffle mode must be either table or random' };
  }

  return { ok: true, config };
}
