import { describe, expect, it } from 'vitest';
import { BID_CAP, BID_FLOOR } from './bidding.js';
import {
  DEFAULT_TABLE_CONFIG,
  MAX_TARGET_SCORE,
  MIN_TARGET_SCORE,
  TARGET_SCORE_PRESETS,
  validateTableConfig,
} from './config.js';
import { TOTAL_HAND_POINTS } from './scoring.js';

/** The tests below only care whether a config was accepted, and read better for it. */
function accepts(input: unknown): boolean {
  return validateTableConfig(input).ok;
}

describe('validateTableConfig', () => {
  it('accepts the default ruleset', () => {
    const result = validateTableConfig(DEFAULT_TABLE_CONFIG);
    expect(result.ok).toBe(true);
  });

  it('accepts every preset offered on the create-table screen', () => {
    for (const preset of TARGET_SCORE_PRESETS) {
      expect(accepts({ ...DEFAULT_TABLE_CONFIG, targetScore: preset.targetScore })).toBe(true);
    }
  });

  // The create screen sends a whole config, but nothing should break if a field is
  // missing — the default for it is the traditional rule.
  it('fills missing fields from the defaults', () => {
    const result = validateTableConfig({ targetScore: 660 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config).toEqual({ ...DEFAULT_TABLE_CONFIG, targetScore: 660 });
    }
  });

  it('rejects anything that is not an object', () => {
    expect(accepts(null)).toBe(false);
    expect(accepts(1650)).toBe(false);
    expect(accepts('standard')).toBe(false);
  });
});

describe('validateTableConfig — target score', () => {
  it('holds the floor at one hand of points, below which a single deal settles the match', () => {
    expect(MIN_TARGET_SCORE).toBe(TOTAL_HAND_POINTS);
    expect(accepts({ targetScore: MIN_TARGET_SCORE })).toBe(true);
    expect(accepts({ targetScore: MIN_TARGET_SCORE - 1 })).toBe(false);
  });

  it('rejects a target above the ceiling, or one that is not a whole number', () => {
    expect(accepts({ targetScore: MAX_TARGET_SCORE })).toBe(true);
    expect(accepts({ targetScore: MAX_TARGET_SCORE + 1 })).toBe(false);
    expect(accepts({ targetScore: 1000.5 })).toBe(false);
    expect(accepts({ targetScore: '1165' })).toBe(false);
  });

  // Deliberately not restricted to multiples of 5, unlike the slam values: a team
  // simply crosses an odd target.
  it('accepts a target that is not a multiple of 5', () => {
    expect(accepts({ targetScore: 1234 })).toBe(true);
  });
});

describe('validateTableConfig — slam values', () => {
  it('requires both to outpay the highest numeric bid', () => {
    expect(accepts({ shelemValue: BID_CAP, sarShelemValue: 330 })).toBe(false);
    expect(accepts({ shelemValue: BID_CAP + 5, sarShelemValue: 330 })).toBe(true);
    expect(accepts({ shelemValue: 200, sarShelemValue: BID_CAP })).toBe(false);
  });

  it('requires multiples of 5, like every other score in the game', () => {
    expect(accepts({ shelemValue: 333, sarShelemValue: 333 })).toBe(false);
    expect(accepts({ shelemValue: 335, sarShelemValue: 335 })).toBe(true);
  });

  // Sar-Shelem outranks Shelem in the auction, so pricing it lower makes the ladder
  // incoherent: nobody would ever bid the harder contract.
  it('refuses to price Sar-Shelem below Shelem, but allows above or equal', () => {
    expect(accepts({ shelemValue: 400, sarShelemValue: 330 })).toBe(false);
    expect(accepts({ shelemValue: 330, sarShelemValue: 330 })).toBe(true);
    expect(accepts({ shelemValue: 330, sarShelemValue: 500 })).toBe(true);
  });
});

describe('validateTableConfig — double negative', () => {
  // The cap is what keeps the penalty from ever landing on a made contract: the
  // smallest makeable numeric bid is BID_FLOOR points.
  it('caps the threshold at the bid floor', () => {
    expect(accepts({ doubleNegativeThreshold: BID_FLOOR })).toBe(true);
    expect(accepts({ doubleNegativeThreshold: BID_FLOOR + 1 })).toBe(false);
  });

  it('allows zero, and rejects negatives and fractions', () => {
    expect(accepts({ doubleNegativeThreshold: 0 })).toBe(true);
    expect(accepts({ doubleNegativeThreshold: -1 })).toBe(false);
    expect(accepts({ doubleNegativeThreshold: 85.5 })).toBe(false);
  });

  it('requires the on/off switches to actually be booleans', () => {
    expect(accepts({ doubleNegativeEnabled: 'yes' })).toBe(false);
    expect(accepts({ sarShelemTakesWidow: 1 })).toBe(false);
    expect(accepts({ doubleNegativeEnabled: false, sarShelemTakesWidow: true })).toBe(true);
  });
});

describe('validateTableConfig — shuffle mode', () => {
  it('accepts the two known modes and nothing else', () => {
    expect(accepts({ shuffleMode: 'table' })).toBe(true);
    expect(accepts({ shuffleMode: 'random' })).toBe(true);
    expect(accepts({ shuffleMode: 'riffle' })).toBe(false);
  });
});
