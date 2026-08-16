import type { Card, Suit } from '../core/types.js';
import { rankIndex } from '../core/deck.js';
import { legalCards } from '../core/trick.js';
import type { Bid } from './types.js';

/**
 * What Shelem does for a player whose clock ran out.
 *
 * **These are not a bot and must not be mistaken for one.** Hokm has a real bot
 * (see hokm/bot.ts) and its timeouts go through it; Shelem has none, and building
 * one is a substantial project deferred for good reason — bad bidding ruins the
 * hand for a *human partner*. So these pick the most defensible legal action, not
 * a good one. A timed-out declarer may well misplay a contract, and that is the
 * honest cost of having a clock before having a bot.
 *
 * The bar each of these has to clear is legality, nothing more. Everything here is
 * pure, so what a timeout does is decided in one testable place rather than inside
 * the room.
 */

/**
 * A timed-out bid is always a pass.
 *
 * Unambiguous, always legal, and never commits somebody to a contract they never
 * chose. The auction already handles the consequences: three passes with nothing
 * on the table redeals the hand.
 */
export function timeoutBid(): Bid {
  return { type: 'pass' };
}

/**
 * A timed-out play is the lowest legal card.
 *
 * Legality comes from `legalCards`, the same function the server enforces and the
 * client greys cards out with, so this can never be the thing that plays an
 * illegal card. Lowest rather than highest because throwing a winner away is the
 * more damaging mistake — this loses the trick cheaply instead of losing a card
 * that could have won a later one.
 */
export function timeoutCard(hand: Card[], leadSuit: Suit | null, trumpSuit: Suit): Card {
  const legal = legalCards(hand, leadSuit, trumpSuit);
  if (legal.length === 0) throw new Error('timeoutCard called with no legal cards');
  return legal.reduce((low, c) => (rankIndex(c.rank) < rankIndex(low.rank) ? c : low));
}

/** How many cards a Shelem declarer buries. */
export const DISCARD_SIZE = 4;

/**
 * A timed-out widow discard: the four lowest-ranking cards.
 *
 * Worth being clear that this is *not* "the worst four", because in Shelem the
 * buried cards still score for the declaring team — they become its first trick,
 * points included. So burying an Ace banks ten points while throwing away a
 * certain trick winner, and the genuinely right choice is a judgement about the
 * hand that this deliberately does not attempt.
 *
 * Lowest rank is simply the rule that needs no strategy and cannot be badly
 * wrong: it keeps every high card for play, which is what a player who had been
 * paying attention would most likely have done.
 */
export function timeoutDiscard(hand: Card[]): Card[] {
  if (hand.length < DISCARD_SIZE) {
    throw new Error(`timeoutDiscard needs at least ${DISCARD_SIZE} cards, got ${hand.length}`);
  }
  return [...hand].sort((a, b) => rankIndex(a.rank) - rankIndex(b.rank)).slice(0, DISCARD_SIZE);
}
