import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from '../core/types.js';
import { createDeck, shuffle } from '../core/deck.js';
import { legalCards } from '../core/trick.js';
import { DISCARD_SIZE, timeoutBid, timeoutCard, timeoutDiscard } from './timeout.js';

/** `A♠ K♥ 3c` — a compact way to write a hand out. */
function hand(spec: string): Card[] {
  const suits: Record<string, Suit> = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' };
  return spec.split(' ').map((token) => ({
    rank: token.slice(0, -1) as Rank,
    suit: suits[token.slice(-1)],
  }));
}

const card = (spec: string): Card => hand(spec)[0];

/** mulberry32 — the same deterministic PRNG the deck tests use. */
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

describe('timeoutBid', () => {
  it('always passes', () => {
    expect(timeoutBid()).toEqual({ type: 'pass' });
  });
});

describe('timeoutCard', () => {
  it('follows suit, taking the lowest card of it', () => {
    const chosen = timeoutCard(hand('9h 2h Kh As'), 'hearts', 'spades');
    expect(chosen).toEqual(card('2h'));
  });

  it('leads its lowest card when nothing has been led', () => {
    expect(timeoutCard(hand('9h 2d Kh As'), null, 'spades')).toEqual(card('2d'));
  });

  it('throws its lowest card when void in the led suit', () => {
    // Void in hearts: everything is legal, including trump, so it sheds the
    // cheapest thing it holds rather than spending a trump.
    expect(timeoutCard(hand('4s 9d 2c'), 'hearts', 'spades')).toEqual(card('2c'));
  });

  it('plays the only card it has when that is the whole choice', () => {
    expect(timeoutCard(hand('7h'), 'hearts', 'spades')).toEqual(card('7h'));
  });

  it('never returns a card outside the legal set, over many random hands', () => {
    // The single bar this has to clear: a timeout must not be the thing that plays
    // an illegal card.
    const rng = seededRng(11);
    for (let trial = 0; trial < 500; trial++) {
      const deck = shuffle(createDeck(), rng);
      const myHand = deck.slice(0, 12);
      const lead = deck[12].suit;
      const chosen = timeoutCard(myHand, lead, 'spades');
      const legal = legalCards(myHand, lead, 'spades');
      expect(legal.some((c) => c.suit === chosen.suit && c.rank === chosen.rank)).toBe(true);
    }
  });

  it('refuses an empty hand rather than inventing a card', () => {
    expect(() => timeoutCard([], 'hearts', 'spades')).toThrow();
  });
});

describe('timeoutDiscard', () => {
  it('buries exactly four cards', () => {
    expect(timeoutDiscard(hand('2h 3h 4h 5h 6h 7h 8h 9h 10h Jh Qh Kh As Ks Qs Js'))).toHaveLength(
      DISCARD_SIZE,
    );
  });

  it('buries the four lowest ranks, keeping every high card for play', () => {
    const buried = timeoutDiscard(hand('Ah 2s 3d Kc 4h 5c As Ks Qs Js 10s 9s 8s 7s 6s 5s'));
    expect(buried.map((c) => c.rank).sort()).toEqual(['2', '3', '4', '5'].sort());
  });

  it('only ever buries cards that were in the hand', () => {
    const rng = seededRng(5);
    for (let trial = 0; trial < 200; trial++) {
      const myHand = shuffle(createDeck(), rng).slice(0, 16);
      const buried = timeoutDiscard(myHand);
      expect(buried).toHaveLength(DISCARD_SIZE);
      for (const c of buried) {
        expect(myHand.some((h) => h.suit === c.suit && h.rank === c.rank)).toBe(true);
      }
      // Four distinct cards, not the same one four times.
      expect(new Set(buried.map((c) => `${c.suit}-${c.rank}`)).size).toBe(DISCARD_SIZE);
    }
  });

  it('leaves the hand it was given alone', () => {
    const myHand = hand('2h 3h 4h 5h 6h 7h 8h 9h 10h Jh Qh Kh As Ks Qs Js');
    const before = myHand.map((c) => `${c.suit}-${c.rank}`).join(',');
    timeoutDiscard(myHand);
    expect(myHand.map((c) => `${c.suit}-${c.rank}`).join(',')).toBe(before);
  });

  it('refuses a hand too small to bury from', () => {
    expect(() => timeoutDiscard(hand('2h 3h 4h'))).toThrow();
  });
});
