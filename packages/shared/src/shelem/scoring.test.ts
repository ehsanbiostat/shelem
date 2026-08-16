import { describe, expect, it } from 'vitest';
import { DEFAULT_TABLE_CONFIG } from './config.js';
import { createDeck } from '../core/deck.js';
import {
  cardPoints,
  DOUBLE_NEGATIVE_THRESHOLD,
  isMatchComplete,
  resolveHandScore,
  TOTAL_HAND_POINTS,
  trickPoints,
  TRICKS_PER_HAND,
} from './scoring.js';

describe('cardPoints', () => {
  it('values Ace, Ten, and Five as scoring cards; everything else as zero', () => {
    expect(cardPoints({ suit: 'spades', rank: 'A' })).toBe(10);
    expect(cardPoints({ suit: 'spades', rank: '10' })).toBe(10);
    expect(cardPoints({ suit: 'spades', rank: '5' })).toBe(5);
    for (const rank of ['2', '3', '4', '6', '7', '8', '9', 'J', 'Q', 'K'] as const) {
      expect(cardPoints({ suit: 'spades', rank })).toBe(0);
    }
  });
});

describe('the 165-point total', () => {
  it('sums to exactly 165 across the full deck plus 13 tricks worth of bonus', () => {
    const deck = createDeck();
    const totalCardPoints = deck.reduce((sum, c) => sum + cardPoints(c), 0);
    const totalTrickBonus = TRICKS_PER_HAND * 5;
    expect(totalCardPoints).toBe(100);
    expect(totalTrickBonus).toBe(65);
    expect(totalCardPoints + totalTrickBonus).toBe(TOTAL_HAND_POINTS);
  });
});

describe('trickPoints', () => {
  it('is 5 for a trick with no scoring cards', () => {
    const cards = [
      { suit: 'spades', rank: '2' },
      { suit: 'spades', rank: '3' },
      { suit: 'spades', rank: '4' },
      { suit: 'spades', rank: '6' },
    ] as const;
    expect(trickPoints([...cards])).toBe(5);
  });

  it('is 45 for a trick of four scoring cards (max per trick)', () => {
    const cards = [
      { suit: 'spades', rank: 'A' },
      { suit: 'hearts', rank: 'A' },
      { suit: 'diamonds', rank: 'A' },
      { suit: 'clubs', rank: 'A' },
    ] as const;
    expect(trickPoints([...cards])).toBe(45);
  });
});

describe('resolveHandScore', () => {
  it('numeric bid made: declarer scores exactly the bid amount, defender scores what they collected', () => {
    const result = resolveHandScore({ type: 'numeric', amount: 120 }, 137, 28, DEFAULT_TABLE_CONFIG);
    expect(result.declarerMadeBid).toBe(true);
    expect(result.declarerDelta).toBe(120);
    expect(result.defenderDelta).toBe(28);
  });

  it('numeric bid failed: declarer loses exactly the bid amount', () => {
    const result = resolveHandScore({ type: 'numeric', amount: 120 }, 100, 65, DEFAULT_TABLE_CONFIG);
    expect(result.declarerMadeBid).toBe(false);
    expect(result.declarerDelta).toBe(-120);
    expect(result.defenderDelta).toBe(65);
  });

  it('Shelem made (all 165 points): +330', () => {
    const result = resolveHandScore({ type: 'shelem' }, 165, 0, DEFAULT_TABLE_CONFIG);
    expect(result.declarerMadeBid).toBe(true);
    expect(result.declarerDelta).toBe(330);
    expect(result.defenderDelta).toBe(0);
  });

  it('Shelem failed (anything less than all 165): -330', () => {
    const result = resolveHandScore({ type: 'shelem' }, 160, 5, DEFAULT_TABLE_CONFIG);
    expect(result.declarerMadeBid).toBe(false);
    expect(result.declarerDelta).toBe(-330);
    expect(result.defenderDelta).toBe(5);
  });

  it('Sar-Shelem made: +330', () => {
    const result = resolveHandScore({ type: 'sarShelem' }, 165, 0, DEFAULT_TABLE_CONFIG);
    expect(result.declarerDelta).toBe(330);
  });

  it('Sar-Shelem failed: -330', () => {
    const result = resolveHandScore({ type: 'sarShelem' }, 150, 15, DEFAULT_TABLE_CONFIG);
    expect(result.declarerDelta).toBe(-330);
    expect(result.defenderDelta).toBe(15);
  });

  // The two slam bids are worth the same. Sar-Shelem outranks Shelem in the
  // bidding by being harder to play, not by paying more.
  it('scores Shelem and Sar-Shelem identically', () => {
    expect(resolveHandScore({ type: 'shelem' }, 165, 0, DEFAULT_TABLE_CONFIG).declarerDelta).toBe(
      resolveHandScore({ type: 'sarShelem' }, 165, 0, DEFAULT_TABLE_CONFIG).declarerDelta,
    );
    expect(resolveHandScore({ type: 'shelem' }, 150, 15, DEFAULT_TABLE_CONFIG).declarerDelta).toBe(
      resolveHandScore({ type: 'sarShelem' }, 150, 15, DEFAULT_TABLE_CONFIG).declarerDelta,
    );
  });
});

describe('isMatchComplete', () => {
  it('is not complete while both teams are short of the target', () => {
    expect(isMatchComplete({ team0: 1100, team1: 900 }, 1165)).toBe(false);
  });

  it('completes on reaching the target exactly, not only on exceeding it', () => {
    expect(isMatchComplete({ team0: 1165, team1: 800 }, 1165)).toBe(true);
  });

  it('completes when either team crosses the target', () => {
    expect(isMatchComplete({ team0: 200, team1: 1700 }, 1165)).toBe(true);
  });

  it('honours a custom target, since the host sets it per table', () => {
    expect(isMatchComplete({ team0: 300, team1: 0 }, 1165)).toBe(false);
    expect(isMatchComplete({ team0: 300, team1: 0 }, 200)).toBe(true);
  });

  // A failed bid subtracts (see resolveHandScore), so a team's running total can
  // go negative — that must never read as having reached the target.
  it('is not complete for a team sitting on a negative score', () => {
    expect(isMatchComplete({ team0: -330, team1: 400 }, 1165)).toBe(false);
  });
});

describe('resolveHandScore — double negative under 85', () => {
  it('doubles a failed numeric bid when the declarers took fewer than 85', () => {
    const result = resolveHandScore({ type: 'numeric', amount: 100 }, 60, 105, DEFAULT_TABLE_CONFIG);
    expect(result.declarerMadeBid).toBe(false);
    expect(result.declarerDoubled).toBe(true);
    expect(result.declarerDelta).toBe(-200);
  });

  // The boundary is the whole rule, so both sides of it are pinned.
  it('does not double at exactly 85 — the threshold is a floor, not a cutoff', () => {
    const result = resolveHandScore({ type: 'numeric', amount: 120 }, 85, 80, DEFAULT_TABLE_CONFIG);
    expect(result.declarerDoubled).toBe(false);
    expect(result.declarerDelta).toBe(-120);
  });

  it('doubles at 84', () => {
    const result = resolveHandScore({ type: 'numeric', amount: 120 }, 84, 81, DEFAULT_TABLE_CONFIG);
    expect(result.declarerDoubled).toBe(true);
    expect(result.declarerDelta).toBe(-240);
  });

  it('doubles against the bid, not a flat amount', () => {
    expect(resolveHandScore({ type: 'numeric', amount: 160 }, 10, 155, DEFAULT_TABLE_CONFIG).declarerDelta).toBe(-320);
    expect(resolveHandScore({ type: 'numeric', amount: 100 }, 10, 155, DEFAULT_TABLE_CONFIG).declarerDelta).toBe(-200);
  });

  it('applies to Shelem and Sar-Shelem too', () => {
    expect(resolveHandScore({ type: 'shelem' }, 40, 125, DEFAULT_TABLE_CONFIG).declarerDelta).toBe(-660);
    expect(resolveHandScore({ type: 'sarShelem' }, 40, 125, DEFAULT_TABLE_CONFIG).declarerDelta).toBe(-660);
  });

  it('still only single-penalises a failed Shelem that took 85 or more', () => {
    expect(resolveHandScore({ type: 'shelem' }, 160, 5, DEFAULT_TABLE_CONFIG).declarerDelta).toBe(-330);
    expect(resolveHandScore({ type: 'sarShelem' }, 85, 80, DEFAULT_TABLE_CONFIG).declarerDelta).toBe(-330);
  });

  // The double is a penalty, not a transfer — nobody receives the extra.
  it('leaves the defenders' + String.fromCharCode(39) + ' score untouched', () => {
    const result = resolveHandScore({ type: 'numeric', amount: 150 }, 20, 145, DEFAULT_TABLE_CONFIG);
    expect(result.defenderDelta).toBe(145);
  });

  it('never doubles a made bid, since making one requires more than the threshold', () => {
    const result = resolveHandScore({ type: 'numeric', amount: 100 }, 100, 65, DEFAULT_TABLE_CONFIG);
    expect(result.declarerMadeBid).toBe(true);
    expect(result.declarerDoubled).toBe(false);
    expect(result.declarerDelta).toBe(100);
  });
});

describe('DOUBLE_NEGATIVE_THRESHOLD', () => {
  it('is just over half the points in a hand', () => {
    expect(DOUBLE_NEGATIVE_THRESHOLD).toBe(85);
    expect(DOUBLE_NEGATIVE_THRESHOLD).toBeGreaterThan(TOTAL_HAND_POINTS / 2);
  });
});

// Every rule above is the *default*; a table can be created with any of them changed
// (see config.ts). These pin that the config is actually what scoring reads.
describe('resolveHandScore — under a non-default table config', () => {
  it('pays each slam its own configured value', () => {
    const config = { ...DEFAULT_TABLE_CONFIG, shelemValue: 200, sarShelemValue: 400 };
    expect(resolveHandScore({ type: 'shelem' }, 165, 0, config).declarerDelta).toBe(200);
    expect(resolveHandScore({ type: 'sarShelem' }, 165, 0, config).declarerDelta).toBe(400);
    expect(resolveHandScore({ type: 'shelem' }, 160, 5, config).declarerDelta).toBe(-200);
    expect(resolveHandScore({ type: 'sarShelem' }, 160, 5, config).declarerDelta).toBe(-400);
  });

  it('leaves a numeric bid priced by the bid itself, whatever the slams are worth', () => {
    const config = { ...DEFAULT_TABLE_CONFIG, shelemValue: 500, sarShelemValue: 500 };
    expect(resolveHandScore({ type: 'numeric', amount: 120 }, 137, 28, config).declarerDelta).toBe(120);
  });

  it('never doubles when the penalty is switched off, however badly the bid failed', () => {
    const config = { ...DEFAULT_TABLE_CONFIG, doubleNegativeEnabled: false };
    const result = resolveHandScore({ type: 'numeric', amount: 120 }, 0, 165, config);
    expect(result.declarerDoubled).toBe(false);
    expect(result.declarerDelta).toBe(-120);
    expect(resolveHandScore({ type: 'shelem' }, 10, 155, config).declarerDelta).toBe(-330);
  });

  it('moves the doubling boundary with the configured threshold', () => {
    const config = { ...DEFAULT_TABLE_CONFIG, doubleNegativeThreshold: 50 };
    // 60 doubles under the default 85 but not under 50.
    expect(resolveHandScore({ type: 'numeric', amount: 100 }, 60, 105, config).declarerDoubled).toBe(false);
    expect(resolveHandScore({ type: 'numeric', amount: 100 }, 49, 116, config).declarerDoubled).toBe(true);
  });

  it('still never doubles a made bid at the highest threshold the config allows', () => {
    // The threshold is capped at BID_FLOOR precisely so this stays true — see config.ts.
    const config = { ...DEFAULT_TABLE_CONFIG, doubleNegativeThreshold: 100 };
    const result = resolveHandScore({ type: 'numeric', amount: 100 }, 100, 65, config);
    expect(result.declarerMadeBid).toBe(true);
    expect(result.declarerDoubled).toBe(false);
  });
});
