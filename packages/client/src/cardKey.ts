import type { Card } from '@shelem/shared';

/** Stable identity string for a card, used as both the React `key` and the Framer
 * Motion `layoutId` in Hand and TrickArea. Sharing the same id scheme between the
 * two is what lets Framer Motion recognize "this card left the hand and is now in
 * the trick" and animate a smooth flight between them instead of an unrelated
 * fade-out/fade-in. */
export function cardKey(card: Card): string {
  return `${card.suit}-${card.rank}`;
}
