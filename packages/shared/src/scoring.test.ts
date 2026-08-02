import { describe, expect, it } from 'vitest';
import { createDeck } from './deck.js';
import { cardPoints, resolveHandScore, TOTAL_HAND_POINTS, trickPoints, TRICKS_PER_HAND } from './scoring.js';

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

  it('Shelem made (all 165 points): +165', () => {
    const result = resolveHandScore({ type: 'shelem' }, 165, 0);
    expect(result.declarerMadeBid).toBe(true);
    expect(result.declarerDelta).toBe(165);
    expect(result.defenderDelta).toBe(0);
  });

  it('Shelem failed (anything less than all 165): -165', () => {
    const result = resolveHandScore({ type: 'shelem' }, 160, 5);
    expect(result.declarerMadeBid).toBe(false);
    expect(result.declarerDelta).toBe(-165);
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
});
