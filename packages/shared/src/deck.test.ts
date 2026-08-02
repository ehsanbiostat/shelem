import { describe, expect, it } from 'vitest';
import { createDeck, deal, shuffle } from './deck.js';

describe('createDeck', () => {
  it('creates 52 unique cards', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
    const unique = new Set(deck.map((c) => `${c.suit}-${c.rank}`));
    expect(unique.size).toBe(52);
  });
});

describe('shuffle', () => {
  it('preserves all cards, just reorders them', () => {
    const deck = createDeck();
    const shuffled = shuffle(deck, () => 0.5);
    expect(shuffled).toHaveLength(52);
    const originalKeys = new Set(deck.map((c) => `${c.suit}-${c.rank}`));
    const shuffledKeys = new Set(shuffled.map((c) => `${c.suit}-${c.rank}`));
    expect(shuffledKeys).toEqual(originalKeys);
  });

  it('is deterministic for a fixed rng', () => {
    const deck = createDeck();
    const rng = (() => {
      let seed = 42;
      return () => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed / 2147483648;
      };
    })();
    const a = shuffle(deck, rng);
    const rng2 = (() => {
      let seed = 42;
      return () => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed / 2147483648;
      };
    })();
    const b = shuffle(deck, rng2);
    expect(a).toEqual(b);
  });
});

describe('deal', () => {
  it('deals 12 cards to each of 4 seats and a 4-card widow, with no overlap', () => {
    const deck = createDeck();
    const { hands, widow } = deal(deck);

    expect(hands).toHaveLength(4);
    for (const hand of hands) {
      expect(hand).toHaveLength(12);
    }
    expect(widow).toHaveLength(4);

    const allDealt = [...hands.flat(), ...widow];
    expect(allDealt).toHaveLength(52);
    const unique = new Set(allDealt.map((c) => `${c.suit}-${c.rank}`));
    expect(unique.size).toBe(52);
  });

  it('throws if not given exactly 52 cards', () => {
    expect(() => deal(createDeck().slice(0, 51))).toThrow();
  });
});
