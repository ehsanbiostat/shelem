import { describe, expect, it } from 'vitest';
import { createDeck, cutDeck, deal, gsrRiffle, shuffle, tableShuffle } from './deck.js';
import type { Card, Seat } from './types.js';

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

describe('gsrRiffle', () => {
  it('preserves all cards, just reorders them', () => {
    const deck = createDeck();
    const riffled = gsrRiffle(deck);
    expect(riffled).toHaveLength(52);
    expect(new Set(riffled.map(key))).toEqual(new Set(deck.map(key)));
  });

  it('interleaves the two halves without reordering within either half', () => {
    // A riffle can only ever merge the two packets — the relative order of the cards
    // inside each packet has to survive, which is exactly why clumps persist.
    const deck = createDeck();
    const riffled = gsrRiffle(deck);
    const positions = riffled.map((c) => deck.findIndex((d) => key(d) === key(c)));
    // Split into the two rising sequences and check each is increasing.
    const rising: number[][] = [];
    for (const p of positions) {
      const seq = rising.find((s) => s[s.length - 1] === p - 1);
      if (seq) seq.push(p);
      else rising.push([p]);
    }
    expect(rising.length).toBeLessThanOrEqual(2);
  });

  it('leaves same-suit cards clumped, unlike a full shuffle', () => {
    const rng = seededRng(7);
    let total = 0;
    for (let trial = 0; trial < 200; trial++) {
      const deck = gsrRiffle(createDeck(), rng); // createDeck() is suit-ordered
      for (let i = 0; i < deck.length - 1; i++) {
        if (deck[i].suit === deck[i + 1].suit) total++;
      }
    }
    // ~24 per deck after one riffle, against ~12 for a uniformly shuffled deck.
    expect(total / 200).toBeGreaterThan(18);
  });
});

describe('cutDeck', () => {
  it('rotates the deck without changing neighbours', () => {
    const deck = createDeck();
    const cut = cutDeck(deck, () => 0.5);
    expect(new Set(cut.map(key))).toEqual(new Set(deck.map(key)));
    const start = deck.findIndex((c) => key(c) === key(cut[0]));
    for (let i = 0; i < deck.length; i++) {
      expect(key(cut[i])).toBe(key(deck[(start + i) % deck.length]));
    }
  });

  it('never leaves the deck uncut', () => {
    const deck = createDeck();
    expect(key(cutDeck(deck, () => 0)[0])).not.toBe(key(deck[0]));
    expect(key(cutDeck(deck, () => 0.999999)[0])).not.toBe(key(deck[0]));
  });
});

describe('tableShuffle', () => {
  it('preserves all cards', () => {
    const deck = createDeck();
    const shuffled = tableShuffle(deck, seededRng(3));
    expect(shuffled).toHaveLength(52);
    expect(new Set(shuffled.map(key))).toEqual(new Set(deck.map(key)));
  });

  it('is deterministic for a fixed rng', () => {
    const a = tableShuffle(createDeck(), seededRng(11));
    const b = tableShuffle(createDeck(), seededRng(11));
    expect(a).toEqual(b);
  });

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
