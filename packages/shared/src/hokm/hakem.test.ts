import { describe, expect, it } from 'vitest';
import type { Card, Seat } from '../core/types.js';
import { createDeck } from '../core/deck.js';
import { drawForHakem } from './hakem.js';

/** Builds a deck whose first cards are exactly what a test wants to turn up, with a
 * plain non-Ace filler behind them so the draw can always run on if it needs to. */
function deckOf(...front: Card[]): Card[] {
  const filler = createDeck().filter((c) => c.rank !== 'A' && !front.some((f) => f.suit === c.suit && f.rank === c.rank));
  return [...front, ...filler];
}

const ace = (suit: Card['suit']): Card => ({ suit, rank: 'A' });
const low = (suit: Card['suit'], rank: Card['rank'] = '3'): Card => ({ suit, rank });

describe('drawForHakem — aceDealSeats', () => {
  it('makes the first player to receive an Ace the Hâkem', () => {
    // Starting at seat 0, cards go to seats 0, 1, 2 — the third is the Ace.
    const deck = deckOf(low('clubs'), low('hearts'), ace('spades'));
    const draw = drawForHakem(deck, 0, 'aceDealSeats');

    expect(draw.hakemSeat).toBe(2);
  });

  it('turns up every card along the way, in the order it was dealt', () => {
    const deck = deckOf(low('clubs'), low('hearts'), ace('spades'));
    const draw = drawForHakem(deck, 0, 'aceDealSeats');

    expect(draw.reveals).toHaveLength(3);
    expect(draw.reveals.map((r) => r.seat)).toEqual([0, 1, 2]);
    expect(draw.reveals[2].card).toEqual(ace('spades'));
  });

  it('deals from the starting seat, not always from seat 0', () => {
    const deck = deckOf(low('clubs'), ace('spades'));
    const draw = drawForHakem(deck, 3, 'aceDealSeats');

    expect(draw.reveals.map((r) => r.seat)).toEqual([3, 0]);
    expect(draw.hakemSeat).toBe(0);
  });

  it('stops at the first Ace rather than looking for a partner', () => {
    const deck = deckOf(ace('spades'), ace('hearts'));
    const draw = drawForHakem(deck, 0, 'aceDealSeats');

    expect(draw.reveals).toHaveLength(1);
    expect(draw.partnerSeat).toBeNull();
  });

  it('finds no partner — the seating already settled that', () => {
    const deck = deckOf(low('clubs'), ace('spades'));
    const draw = drawForHakem(deck, 0, 'aceDealSeats');

    expect(draw.hakemSeat).toBe(1);
    expect(draw.partnerSeat).toBeNull();
  });

  it('wraps past the fourth seat when no Ace has turned up yet', () => {
    const deck = deckOf(low('clubs'), low('hearts'), low('diamonds'), low('spades'), ace('spades'));
    const draw = drawForHakem(deck, 0, 'aceDealSeats');

    expect(draw.reveals.map((r) => r.seat)).toEqual([0, 1, 2, 3, 0]);
    expect(draw.hakemSeat).toBe(0);
  });
});

describe('drawForHakem — aceDealTeams', () => {
  it('carries on past the first Ace to a second, which finds the partner', () => {
    // Seats 0, 1, 2, 3, 0 — Aces to seat 1 and seat 3.
    const deck = deckOf(low('clubs'), ace('spades'), low('hearts'), ace('hearts'));
    const draw = drawForHakem(deck, 0, 'aceDealTeams');

    expect(draw.hakemSeat).toBe(1);
    expect(draw.partnerSeat).toBe(3);
  });

  it('names the partner even when they are sitting next to the Hâkem', () => {
    // Where they then *sit* is the room's business — see seatPartnerOpposite.
    const deck = deckOf(ace('spades'), ace('hearts'));
    const draw = drawForHakem(deck, 0, 'aceDealTeams');

    expect(draw.hakemSeat).toBe(0);
    expect(draw.partnerSeat).toBe(1);
  });

  it('deals no further card to the Hâkem once their Ace has landed', () => {
    // The whole point: a player who has been chosen is out of the draw. Before
    // this, cards kept going round all four seats and a second Ace to the Hâkem
    // was merely ignored — which both looked wrong and wasted about a quarter of
    // the partner search on somebody who could not be the partner.
    const deck = deckOf(ace('spades'), low('hearts'), low('clubs'), low('diamonds'), low('spades', '4'), ace('hearts'));
    const draw = drawForHakem(deck, 0, 'aceDealTeams');

    expect(draw.hakemSeat).toBe(0);
    const afterHakem = draw.reveals.slice(1);
    expect(afterHakem.some((r) => r.seat === draw.hakemSeat)).toBe(false);
    expect(afterHakem.map((r) => r.seat)).toEqual([1, 2, 3, 1, 2]);
    expect(draw.partnerSeat).toBe(2);
  });

  it('only ever turns up two Aces — the second one ends the draw', () => {
    const deck = deckOf(low('clubs'), ace('spades'), low('hearts'), ace('hearts'));
    const draw = drawForHakem(deck, 0, 'aceDealTeams');

    expect(draw.reveals.filter((r) => r.card.rank === 'A')).toHaveLength(2);
    expect(draw.reveals[draw.reveals.length - 1].card.rank).toBe('A');
  });

  it('names a partner who is not the Hâkem', () => {
    const deck = deckOf(low('clubs'), ace('spades'), low('hearts'), ace('hearts'));
    const { hakemSeat, partnerSeat } = drawForHakem(deck, 0, 'aceDealTeams');

    expect(partnerSeat).not.toBeNull();
    expect(partnerSeat).not.toBe(hakemSeat);
  });
});

describe('drawForHakem — random', () => {
  it('turns up no cards at all', () => {
    const draw = drawForHakem(createDeck(), 0, 'random', () => 0.5);
    expect(draw.reveals).toEqual([]);
  });

  it('picks a seat from the rng and finds no partner', () => {
    expect(drawForHakem(createDeck(), 0, 'random', () => 0).hakemSeat).toBe(0);
    expect(drawForHakem(createDeck(), 0, 'random', () => 0.99).hakemSeat).toBe(3);
    expect(drawForHakem(createDeck(), 0, 'random', () => 0.5).partnerSeat).toBeNull();
  });
});

describe('drawForHakem — bad decks', () => {
  it('throws rather than seating a Hâkem when no Ace can turn up', () => {
    const aceless = createDeck().filter((c) => c.rank !== 'A');
    expect(() => drawForHakem(aceless, 0, 'aceDealSeats')).toThrow(/Ace/);
  });

  it('throws when the cards run out before a partner is found', () => {
    expect(() => drawForHakem([ace('spades')], 0, 'aceDealTeams')).toThrow(/partner/);
  });
});
