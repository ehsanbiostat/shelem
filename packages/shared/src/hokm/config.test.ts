import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HOKM_CONFIG,
  MAX_HOKM_TARGET,
  MAX_HOKM_VALUE,
  validateHokmConfig,
} from './config.js';

/** Unwraps a result the test expects to be accepted. */
function accepted(input: unknown) {
  const result = validateHokmConfig(input);
  if (!result.ok) throw new Error(`expected config to validate, got: ${result.error}`);
  return result.config;
}

describe('validateHokmConfig', () => {
  it('accepts an empty object and returns the traditional ruleset', () => {
    expect(accepted({})).toEqual(DEFAULT_HOKM_CONFIG);
  });

  it('fills every field the caller left out', () => {
    const config = accepted({ targetScore: 5 });

    expect(config.targetScore).toBe(5);
    expect(config.kotValue).toBe(DEFAULT_HOKM_CONFIG.kotValue);
    expect(config.hakemSelection).toBe(DEFAULT_HOKM_CONFIG.hakemSelection);
  });

  it('rejects anything that is not an object', () => {
    expect(validateHokmConfig(null).ok).toBe(false);
    expect(validateHokmConfig(7).ok).toBe(false);
    expect(validateHokmConfig('7').ok).toBe(false);
  });

  it('defaults to a fresh deck each hand, unlike Shelem', () => {
    // Shelem's light shuffle exists to make long suits for the auction; Hokm has
    // no auction, so it starts from random instead.
    expect(DEFAULT_HOKM_CONFIG.shuffleMode).toBe('random');
  });
});

describe('validateHokmConfig — target score', () => {
  it('accepts a whole number in range', () => {
    expect(accepted({ targetScore: 1 }).targetScore).toBe(1);
    expect(accepted({ targetScore: MAX_HOKM_TARGET }).targetScore).toBe(MAX_HOKM_TARGET);
  });

  it('rejects zero, negatives, fractions and anything past the ceiling', () => {
    expect(validateHokmConfig({ targetScore: 0 }).ok).toBe(false);
    expect(validateHokmConfig({ targetScore: -1 }).ok).toBe(false);
    expect(validateHokmConfig({ targetScore: 7.5 }).ok).toBe(false);
    expect(validateHokmConfig({ targetScore: MAX_HOKM_TARGET + 1 }).ok).toBe(false);
    expect(validateHokmConfig({ targetScore: NaN }).ok).toBe(false);
  });
});

describe('validateHokmConfig — the scoring ladder', () => {
  it('accepts values a table priced for itself', () => {
    const config = accepted({ handValue: 2, kotValue: 5, hakemKotiValue: 11 });
    expect([config.handValue, config.kotValue, config.hakemKotiValue]).toEqual([2, 5, 11]);
  });

  it('accepts a table that flattens the ladder entirely', () => {
    // Everything equal is a legitimate house rule — it just means sweeps aren't
    // worth extra. It's only inversion that's incoherent.
    expect(validateHokmConfig({ handValue: 1, kotValue: 1, hakemKotiValue: 1 }).ok).toBe(true);
  });

  it('refuses to price a Kot below an ordinary won hand', () => {
    const result = validateHokmConfig({ handValue: 3, kotValue: 2 });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toMatch(/Kot/);
  });

  it('refuses to price a Hâkem Koti below a Kot', () => {
    const result = validateHokmConfig({ kotValue: 5, hakemKotiValue: 4 });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toMatch(/Koti/);
  });

  it('rejects a rung that is zero, fractional or past the ceiling', () => {
    expect(validateHokmConfig({ handValue: 0 }).ok).toBe(false);
    expect(validateHokmConfig({ kotValue: 2.5, hakemKotiValue: 3 }).ok).toBe(false);
    expect(validateHokmConfig({ hakemKotiValue: MAX_HOKM_VALUE + 1 }).ok).toBe(false);
  });
});

describe('validateHokmConfig — Hâkem selection', () => {
  it('accepts each of the three ways a table can settle it', () => {
    for (const mode of ['aceDealTeams', 'aceDealSeats', 'random'] as const) {
      expect(accepted({ hakemSelection: mode }).hakemSelection).toBe(mode);
    }
  });

  it('rejects anything else', () => {
    expect(validateHokmConfig({ hakemSelection: 'coinToss' }).ok).toBe(false);
    expect(validateHokmConfig({ hakemSelection: true }).ok).toBe(false);
  });

  it('keeps the ceremony but not the re-pairing by default', () => {
    expect(DEFAULT_HOKM_CONFIG.hakemSelection).toBe('aceDealSeats');
  });
});

describe('validateHokmConfig — shuffle', () => {
  it('accepts both modes and rejects anything else', () => {
    expect(accepted({ shuffleMode: 'table' }).shuffleMode).toBe('table');
    expect(accepted({ shuffleMode: 'random' }).shuffleMode).toBe('random');
    expect(validateHokmConfig({ shuffleMode: 'riffle' }).ok).toBe(false);
  });
});
