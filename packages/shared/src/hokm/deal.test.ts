import { describe, expect, it } from 'vitest';
import { createDeck } from '../core/deck.js';
import type { Seat } from '../core/types.js';
import { dealHokm, HOKM_HAND_SIZE } from './deal.js';

const key = (c: { suit: string; rank: string }) => `${c.suit}-${c.rank}`;

describe('dealHokm', () => {
  it('gives every seat five to open and eight more after, thirteen in all', () => {
    const { opening, rest } = dealHokm(createDeck(), 0);

    for (let seat = 0; seat < 4; seat++) {
      expect(opening[seat]).toHaveLength(5);
      expect(rest[seat]).toHaveLength(8);
      expect(opening[seat].length + rest[seat].length).toBe(HOKM_HAND_SIZE);
    }
  });

  it('uses the whole deck exactly once', () => {
    const { opening, rest } = dealHokm(createDeck(), 2);
    const all = [...opening.flat(), ...rest.flat()];

    expect(all).toHaveLength(52);
    expect(new Set(all.map(key)).size).toBe(52);
  });

  it('deals the first packet to the Hâkem before anyone else', () => {
    const deck = createDeck();
    const hakem: Seat = 2;
    const { opening } = dealHokm(deck, hakem);

    expect(opening[2]).toEqual(deck.slice(0, 5));
    expect(opening[3]).toEqual(deck.slice(5, 10));
    expect(opening[0]).toEqual(deck.slice(10, 15));
    expect(opening[1]).toEqual(deck.slice(15, 20));
  });

  it('deals the two later packets in the same order, four at a time', () => {
    const deck = createDeck();
    const { rest } = dealHokm(deck, 0);

    // Second packet: seats 0,1,2,3 take four each from card 20.
    expect(rest[0].slice(0, 4)).toEqual(deck.slice(20, 24));
    expect(rest[1].slice(0, 4)).toEqual(deck.slice(24, 28));
    // Third packet resumes at card 36, again starting with the Hâkem.
    expect(rest[0].slice(4)).toEqual(deck.slice(36, 40));
    expect(rest[1].slice(4)).toEqual(deck.slice(40, 44));
  });

  it('keeps the opening five and the remaining eight strictly apart', () => {
    // The Hâkem chooses trump off the opening packet alone, so nothing from the
    // rest of the deal may have leaked into it.
    const { opening, rest } = dealHokm(createDeck(), 1);

    for (let seat = 0; seat < 4; seat++) {
      const openKeys = new Set(opening[seat].map(key));
      expect(rest[seat].some((c) => openKeys.has(key(c)))).toBe(false);
    }
  });

  it('deals every seat a full hand whichever seat is Hâkem', () => {
    for (const hakem of [0, 1, 2, 3] as Seat[]) {
      const { opening, rest } = dealHokm(createDeck(), hakem);
      expect(opening.every((h) => h.length === 5)).toBe(true);
      expect(rest.every((h) => h.length === 8)).toBe(true);
    }
  });

  it('throws if not given exactly 52 cards', () => {
    expect(() => dealHokm(createDeck().slice(0, 51), 0)).toThrow();
  });
});
