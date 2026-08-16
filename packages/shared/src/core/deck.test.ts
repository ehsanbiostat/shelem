import { describe, expect, it } from 'vitest';
import { createDeck, cutDeck, gsrRiffle, shuffle, tableShuffle } from './deck.js';

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
});
