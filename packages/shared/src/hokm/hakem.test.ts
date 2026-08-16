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

  it('leaves partnerships as they were seated — opposite players', () => {
    const deck = deckOf(low('clubs'), ace('spades'));
    const draw = drawForHakem(deck, 0, 'aceDealSeats');

    expect(draw.teamOfSeat).toEqual([0, 1, 0, 1]);
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

  it('pairs the two Ace-holders even when they are sitting side by side', () => {
    const deck = deckOf(ace('spades'), ace('hearts'));
    const draw = drawForHakem(deck, 0, 'aceDealTeams');

    expect(draw.hakemSeat).toBe(0);
    expect(draw.partnerSeat).toBe(1);
    // Seats 0 and 1 are now partners, which seat parity would never have given.
    expect(draw.teamOfSeat[0]).toBe(draw.teamOfSeat[1]);
    expect(draw.teamOfSeat[2]).toBe(draw.teamOfSeat[3]);
    expect(draw.teamOfSeat[0]).not.toBe(draw.teamOfSeat[2]);
  });

  it('keeps dealing when a second Ace lands back on the Hâkem', () => {
    // Seats 0,1,2,3,0(2nd Ace, same player),1 — the pairing has to wait for seat 1.
    const deck = deckOf(ace('spades'), low('hearts'), low('clubs'), low('diamonds'), ace('hearts'), ace('clubs'));
    const draw = drawForHakem(deck, 0, 'aceDealTeams');

    expect(draw.hakemSeat).toBe(0);
    expect(draw.partnerSeat).toBe(1);
  });

  it('gives all four seats a team, two to a side', () => {
    const deck = deckOf(low('clubs'), ace('spades'), low('hearts'), ace('hearts'));
    const { teamOfSeat } = drawForHakem(deck, 0, 'aceDealTeams');

    expect(teamOfSeat).toHaveLength(4);
    expect(teamOfSeat.filter((t) => t === 0)).toHaveLength(2);
    expect(teamOfSeat.filter((t) => t === 1)).toHaveLength(2);
  });

  it('puts the Hâkem and their partner on the same side, and the other two opposite', () => {
    const deck = deckOf(low('clubs'), ace('spades'), low('hearts'), ace('hearts'));
    const { hakemSeat, partnerSeat, teamOfSeat } = drawForHakem(deck, 0, 'aceDealTeams');

    expect(teamOfSeat[hakemSeat]).toBe(teamOfSeat[partnerSeat!]);
    const others = ([0, 1, 2, 3] as Seat[]).filter((s) => s !== hakemSeat && s !== partnerSeat);
    expect(teamOfSeat[others[0]]).toBe(teamOfSeat[others[1]]);
    expect(teamOfSeat[others[0]]).not.toBe(teamOfSeat[hakemSeat]);
  });
});

describe('drawForHakem — random', () => {
  it('turns up no cards at all', () => {
    const draw = drawForHakem(createDeck(), 0, 'random', () => 0.5);
    expect(draw.reveals).toEqual([]);
  });

  it('picks a seat from the rng and leaves partnerships to the seating', () => {
    expect(drawForHakem(createDeck(), 0, 'random', () => 0).hakemSeat).toBe(0);
    expect(drawForHakem(createDeck(), 0, 'random', () => 0.99).hakemSeat).toBe(3);
    expect(drawForHakem(createDeck(), 0, 'random', () => 0.5).teamOfSeat).toEqual([0, 1, 0, 1]);
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
