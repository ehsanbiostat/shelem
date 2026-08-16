import { describe, expect, it } from 'vitest';
import { createDeck, shuffle, tableShuffle } from '../core/deck.js';
import type { Card, Seat } from '../core/types.js';
import { deal } from './deal.js';

const key = (c: { suit: string; rank: string }) => `${c.suit}-${c.rank}`;

/** mulberry32 — a real PRNG. A naive LCG loses precision in JS floats badly enough to
 * produce a near-perfect alternating riffle, which would silently invalidate these tests. */
function seededRng(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('deal', () => {
  it('deals 12 cards to each of 4 seats and a 4-card widow, with no overlap', () => {
    const deck = createDeck();
    const { hands, widow } = deal(deck, 0);

    expect(hands).toHaveLength(4);
    for (const hand of hands) {
      expect(hand).toHaveLength(12);
    }
    expect(widow).toHaveLength(4);

    const allDealt = [...hands.flat(), ...widow];
    expect(allDealt).toHaveLength(52);
    const unique = new Set(allDealt.map(key));
    expect(unique.size).toBe(52);
  });

  it('gives each seat one contiguous block, dealing left of the dealer first and the dealer last', () => {
    const deck = createDeck();
    const dealer: Seat = 2;
    const { hands, widow } = deal(deck, dealer);

    expect(hands[3]).toEqual(deck.slice(0, 12));
    expect(hands[0]).toEqual(deck.slice(12, 24));
    expect(hands[1]).toEqual(deck.slice(24, 36));
    expect(widow).toEqual(deck.slice(36, 40));
    expect(hands[2]).toEqual(deck.slice(40, 52));
  });

  it('deals every seat a full hand whichever seat holds the deal', () => {
    for (const dealer of [0, 1, 2, 3] as Seat[]) {
      const { hands, widow } = deal(createDeck(), dealer);
      expect(hands.every((h) => h.length === 12)).toBe(true);
      expect(widow).toHaveLength(4);
    }
  });

  it('throws if not given exactly 52 cards', () => {
    expect(() => deal(createDeck().slice(0, 51), 0)).toThrow();
  });
});

describe('deal — with the light shuffle', () => {
  it('feeding a grouped deck through tableShuffle + deal gives longer suits than a full shuffle', () => {
    // The whole point of the light shuffle, end to end: same deal function, same starting
    // deck, only the shuffle differs. Uses a suit-ordered deck as a stand-in for the
    // grouped deck that comes back from a played hand.
    const meanLongestSuit = (makeDeck: () => Card[]) => {
      let total = 0;
      let count = 0;
      for (let trial = 0; trial < 2000; trial++) {
        for (const hand of deal(makeDeck(), 0).hands) {
          const bySuit = new Map<string, number>();
          for (const card of hand) bySuit.set(card.suit, (bySuit.get(card.suit) ?? 0) + 1);
          total += Math.max(...bySuit.values());
          count++;
        }
      }
      return total / count;
    };

    const light = seededRng(21);
    const full = seededRng(22);
    const lightly = meanLongestSuit(() => tableShuffle(createDeck(), light));
    const fully = meanLongestSuit(() => shuffle(createDeck(), full));

    expect(fully).toBeCloseTo(4.63, 1);
    expect(lightly).toBeGreaterThan(fully + 0.15);
  });
});
