import type { Card, Seat } from '../core/types.js';

/** Five, then four, then four — thirteen each, the way a Hokm hand is dealt. The
 * first packet is its own round because trump is declared off it. */
export const HOKM_PACKETS = [5, 4, 4] as const;
export const HOKM_HAND_SIZE = 13;

export interface HokmDeal {
  /** The opening packet of five per seat. The Hâkem declares trump off these alone,
   * with the other eight still in the dealer's hand. */
  opening: [Card[], Card[], Card[], Card[]];
  /** The remaining eight per seat, dealt once trump is named. */
  rest: [Card[], Card[], Card[], Card[]];
}

/**
 * Deals a 52-card deck in Hokm's packets, starting with the Hâkem — one of that
 * player's privileges is being dealt to first.
 *
 * Split in two rather than returning finished hands because the split is the game:
 * the Hâkem has to choose trump knowing only five cards, and the server can't hand
 * anyone their remaining eight before that choice is made without giving away what
 * the rest of the deal held.
 *
 * Unlike Shelem's block deal, this hands out ordinary packets — Hokm has no auction,
 * so there's no reason to manufacture long suits (see shelem/deal.ts).
 */
export function dealHokm(shuffledDeck: Card[], hakemSeat: Seat): HokmDeal {
  if (shuffledDeck.length !== 52) {
    throw new Error(`dealHokm() requires a 52-card deck, got ${shuffledDeck.length}`);
  }

  const opening: [Card[], Card[], Card[], Card[]] = [[], [], [], []];
  const rest: [Card[], Card[], Card[], Card[]] = [[], [], [], []];

  let cursor = 0;
  HOKM_PACKETS.forEach((size, round) => {
    const target = round === 0 ? opening : rest;
    for (let offset = 0; offset < 4; offset++) {
      const seat = (hakemSeat + offset) % 4;
      target[seat].push(...shuffledDeck.slice(cursor, cursor + size));
      cursor += size;
    }
  });

  return { opening, rest };
}
