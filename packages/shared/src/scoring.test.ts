import { describe, expect, it } from 'vitest';
import { createDeck } from './deck.js';
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
    const result = resolveHandScore({ type: 'numeric', amount: 120 }, 137, 28);
    expect(result.declarerMadeBid).toBe(true);
    expect(result.declarerDelta).toBe(120);
    expect(result.defenderDelta).toBe(28);
  });

  it('numeric bid failed: declarer loses exactly the bid amount', () => {
    const result = resolveHandScore({ type: 'numeric', amount: 120 }, 100, 65);
    expect(result.declarerMadeBid).toBe(false);
    expect(result.declarerDelta).toBe(-120);
    expect(result.defenderDelta).toBe(65);
  });

  it('Shelem made (all 165 points): +330', () => {
    const result = resolveHandScore({ type: 'shelem' }, 165, 0);
    expect(result.declarerMadeBid).toBe(true);
    expect(result.declarerDelta).toBe(330);
    expect(result.defenderDelta).toBe(0);
  });

  it('Shelem failed (anything less than all 165): -330', () => {
    const result = resolveHandScore({ type: 'shelem' }, 160, 5);
    expect(result.declarerMadeBid).toBe(false);
    expect(result.declarerDelta).toBe(-330);
    expect(result.defenderDelta).toBe(5);
  });

  it('Sar-Shelem made: +330', () => {
    const result = resolveHandScore({ type: 'sarShelem' }, 165, 0);
    expect(result.declarerDelta).toBe(330);
  });

  it('Sar-Shelem failed: -330', () => {
    const result = resolveHandScore({ type: 'sarShelem' }, 150, 15);
    expect(result.declarerDelta).toBe(-330);
    expect(result.defenderDelta).toBe(15);
  });

  // The two slam bids are worth the same. Sar-Shelem outranks Shelem in the
  // bidding by being harder to play, not by paying more.
  it('scores Shelem and Sar-Shelem identically', () => {
    expect(resolveHandScore({ type: 'shelem' }, 165, 0).declarerDelta).toBe(
      resolveHandScore({ type: 'sarShelem' }, 165, 0).declarerDelta,
    );
    expect(resolveHandScore({ type: 'shelem' }, 150, 15).declarerDelta).toBe(
      resolveHandScore({ type: 'sarShelem' }, 150, 15).declarerDelta,
    );
  });
});

describe('isMatchComplete', () => {
  it('is not complete while both teams are short of the target', () => {
    expect(isMatchComplete({ team0: 1600, team1: 1200 }, 1650)).toBe(false);
  });

  it('completes on reaching the target exactly, not only on exceeding it', () => {
    expect(isMatchComplete({ team0: 1650, team1: 800 }, 1650)).toBe(true);
  });

  it('completes when either team crosses the target', () => {
    expect(isMatchComplete({ team0: 200, team1: 1700 }, 1650)).toBe(true);
  });

  it('honours a custom target, since the host sets it per table', () => {
    expect(isMatchComplete({ team0: 300, team1: 0 }, 1650)).toBe(false);
    expect(isMatchComplete({ team0: 300, team1: 0 }, 200)).toBe(true);
  });

  // A failed bid subtracts (see resolveHandScore), so a team's running total can
  // go negative — that must never read as having reached the target.
  it('is not complete for a team sitting on a negative score', () => {
    expect(isMatchComplete({ team0: -330, team1: 400 }, 1650)).toBe(false);
  });
});

describe('resolveHandScore — double negative under 85', () => {
  it('doubles a failed numeric bid when the declarers took fewer than 85', () => {
    const result = resolveHandScore({ type: 'numeric', amount: 100 }, 60, 105);
    expect(result.declarerMadeBid).toBe(false);
    expect(result.declarerDoubled).toBe(true);
    expect(result.declarerDelta).toBe(-200);
  });

  // The boundary is the whole rule, so both sides of it are pinned.
  it('does not double at exactly 85 — the threshold is a floor, not a cutoff', () => {
    const result = resolveHandScore({ type: 'numeric', amount: 120 }, 85, 80);
    expect(result.declarerDoubled).toBe(false);
    expect(result.declarerDelta).toBe(-120);
  });

  it('doubles at 84', () => {
    const result = resolveHandScore({ type: 'numeric', amount: 120 }, 84, 81);
    expect(result.declarerDoubled).toBe(true);
    expect(result.declarerDelta).toBe(-240);
  });

  it('doubles against the bid, not a flat amount', () => {
    expect(resolveHandScore({ type: 'numeric', amount: 160 }, 10, 155).declarerDelta).toBe(-320);
    expect(resolveHandScore({ type: 'numeric', amount: 100 }, 10, 155).declarerDelta).toBe(-200);
  });

  it('applies to Shelem and Sar-Shelem too', () => {
    expect(resolveHandScore({ type: 'shelem' }, 40, 125).declarerDelta).toBe(-660);
    expect(resolveHandScore({ type: 'sarShelem' }, 40, 125).declarerDelta).toBe(-660);
  });

  it('still only single-penalises a failed Shelem that took 85 or more', () => {
    expect(resolveHandScore({ type: 'shelem' }, 160, 5).declarerDelta).toBe(-330);
    expect(resolveHandScore({ type: 'sarShelem' }, 85, 80).declarerDelta).toBe(-330);
  });

  // The double is a penalty, not a transfer — nobody receives the extra.
  it('leaves the defenders' + String.fromCharCode(39) + ' score untouched', () => {
    const result = resolveHandScore({ type: 'numeric', amount: 150 }, 20, 145);
    expect(result.defenderDelta).toBe(145);
  });

  it('never doubles a made bid, since making one requires more than the threshold', () => {
    const result = resolveHandScore({ type: 'numeric', amount: 100 }, 100, 65);
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
