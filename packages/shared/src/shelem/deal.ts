import type { Card, Seat } from '../core/types.js';

export interface Deal {
  /** Index 0-3, one 12-card hand per seat. */
  hands: [Card[], Card[], Card[], Card[]];
  /** The 4-card widow. */
  widow: Card[];
}

/**
 * Deals a 52-card deck the way it's dealt at the table: one unbroken block of 12 to each
 * player in turn starting left of the dealer, then 4 off the top for the widow, then the
 * dealer's own 12 last.
 *
 * Dealing contiguous blocks rather than one card at a time is what turns a lightly
 * shuffled deck into long suits — a run of same-suit cards goes to a single player intact
 * instead of being split one-per-seat. Paired with `tableShuffle`, this is the whole
 * mechanism; with a uniformly shuffled deck it changes nothing.
 *
 * This block deal is specific to Shelem, and is the reason it lives here rather than in
 * core: Hokm deals in the ordinary 5-4-4 packets (see hokm/deal.ts).
 */
export function deal(shuffledDeck: Card[], dealerSeat: Seat): Deal {
  if (shuffledDeck.length !== 52) {
    throw new Error(`deal() requires a 52-card deck, got ${shuffledDeck.length}`);
  }

  const hands: [Card[], Card[], Card[], Card[]] = [[], [], [], []];
  let cursor = 0;
  for (let offset = 1; offset <= 3; offset++) {
    hands[(dealerSeat + offset) % 4] = shuffledDeck.slice(cursor, cursor + 12);
    cursor += 12;
  }
  const widow = shuffledDeck.slice(cursor, cursor + 4);
  cursor += 4;
  hands[dealerSeat] = shuffledDeck.slice(cursor, cursor + 12);

  return { hands, widow };
}
