import type { Card, Seat } from '../core/types.js';
import type { HakemSelection } from './config.js';

export interface HakemReveal {
  seat: Seat;
  card: Card;
}

export interface HakemDraw {
  /** Every card turned face up, in the order it was turned. Empty when the table
   * plays without the ceremony. Fed to the client one at a time so all four seats
   * watch the same draw rather than being handed a result. */
  reveals: HakemReveal[];
  hakemSeat: Seat;
  /** The seat the second Ace found, on `aceDealTeams` only — the Hâkem's partner.
   * Null when partnerships come from the seating instead.
   *
   * Note this is where the partner *was sitting* when their Ace turned up. Seating
   * them opposite the Hâkem is the caller's job — see HokmRoom.seatFirstHakem. */
  partnerSeat: Seat | null;
}

/**
 * The next seat to receive a card.
 *
 * Once the Hâkem is known they are **out of the draw**: they have already been
 * chosen, so the search for a partner deals only to the other three. Exactly one
 * seat is ever excluded, so a single skip is enough — two in a row is impossible.
 */
function nextSeat(from: Seat, hakemSeat: Seat | null): Seat {
  const next = ((from + 1) % 4) as Seat;
  return hakemSeat !== null && next === hakemSeat ? (((next + 1) % 4) as Seat) : next;
}

/**
 * Finds the Hâkem by dealing cards face up around the table until an Ace turns up.
 *
 * On `aceDealTeams` the draw carries on past the first Ace to a second, and those two
 * players become partners — so the pairing comes out of the cards rather than the
 * seating. The other two are partners by elimination. The Hâkem takes no further
 * cards once their Ace lands; only the remaining three are still in the draw.
 *
 * `random` skips the ceremony: a Hâkem is picked and no cards are turned.
 *
 * Teams are deliberately not decided here. This function finds *who* the Aces
 * chose; where they then sit is the room's business, because seating them opposite
 * each other means physically moving people.
 *
 * Note the deck is only *read* here. The cards shown are not removed — the ceremony
 * happens before the hand is dealt, and at a real table those cards go straight back
 * in. The caller shuffles again before dealing.
 */
export function drawForHakem(
  deck: Card[],
  startSeat: Seat,
  mode: HakemSelection,
  rng: () => number = Math.random,
): HakemDraw {
  if (mode === 'random') {
    return {
      reveals: [],
      hakemSeat: Math.floor(rng() * 4) as Seat,
      partnerSeat: null,
    };
  }

  const reveals: HakemReveal[] = [];
  let hakemSeat: Seat | null = null;
  let partnerSeat: Seat | null = null;

  let seat: Seat = startSeat;
  for (const card of deck) {
    reveals.push({ seat, card });

    if (card.rank === 'A') {
      if (hakemSeat === null) {
        hakemSeat = seat;
        // On the seat-based pairing the draw is over the moment the Hâkem is known;
        // there's no partner to find, because the seating already settled it.
        if (mode === 'aceDealSeats') break;
      } else {
        // Can only be one of the other three — the Hâkem stopped receiving cards
        // the moment they were chosen.
        partnerSeat = seat;
        break;
      }
    }

    seat = nextSeat(seat, hakemSeat);
  }

  // A 52-card deck holds four Aces, so neither of these can happen in a real draw.
  // They're here so a caller that passes a short or Ace-less deck fails loudly at
  // the point of the mistake rather than silently seating the wrong Hâkem.
  if (hakemSeat === null) {
    throw new Error('Hâkem draw ran out of cards before finding an Ace');
  }
  if (mode === 'aceDealTeams' && partnerSeat === null) {
    throw new Error('Hâkem draw ran out of cards before finding a partner');
  }

  return { reveals, hakemSeat, partnerSeat };
}
