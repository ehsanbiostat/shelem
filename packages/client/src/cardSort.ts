import type { Card, Suit } from '@shelem/shared';
import { rankIndex } from '@shelem/shared';

/** Base right-to-left reading order, before trump is known: spades, hearts, clubs,
 * diamonds — i.e. left-to-right: diamonds, clubs, hearts, spades. Colors strictly
 * alternate (red, black, red, black), so same-colored suits are never adjacent and
 * therefore always visually distinguishable at a glance.
 *
 * This sequence is a 4-cycle (diamonds → clubs → hearts → spades → diamonds…), and
 * rotating a perfectly-alternating 4-cycle always preserves the alternation. That's
 * what lets the trump reshuffle below just rotate this list instead of special-casing
 * each trump suit. */
const SUIT_CYCLE: readonly Suit[] = ['diamonds', 'clubs', 'hearts', 'spades'];

/** Left-to-right suit order. Once trump is known, the cycle is rotated so trump
 * always lands in the rightmost group; the other three keep their relative order. */
function suitDisplayOrder(trumpSuit: Suit | null): readonly Suit[] {
  if (!trumpSuit) return SUIT_CYCLE;
  const t = SUIT_CYCLE.indexOf(trumpSuit);
  return [SUIT_CYCLE[(t + 1) % 4], SUIT_CYCLE[(t + 2) % 4], SUIT_CYCLE[(t + 3) % 4], SUIT_CYCLE[t]];
}

/** Sorts a hand for display, left to right, by `suitDisplayOrder`; within a suit,
 * cards run low to high so the highest card sits at that suit group's right edge. */
export function sortHand(cards: Card[], trumpSuit: Suit | null = null): Card[] {
  const order = suitDisplayOrder(trumpSuit);
  return [...cards].sort((a, b) => {
    const suitDiff = order.indexOf(a.suit) - order.indexOf(b.suit);
    if (suitDiff !== 0) return suitDiff;
    return rankIndex(a.rank) - rankIndex(b.rank);
  });
}
