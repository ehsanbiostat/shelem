import type { Card, Seat, Team } from '../core/types.js';
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
   * Null when partnerships come from the seating instead. */
  partnerSeat: Seat | null;
  /** Which team each seat is on, by seat index. On `aceDealTeams` this is the
   * pairing the two Aces produced; otherwise it's seat parity, unchanged. */
  teamOfSeat: [Team, Team, Team, Team];
}

/** Partners are whoever sits opposite: seats 0 & 2 against seats 1 & 3. */
function teamsBySeat(): [Team, Team, Team, Team] {
  return [0, 1, 0, 1];
}

/**
 * Finds the Hâkem by dealing cards face up around the table until an Ace turns up.
 *
 * On `aceDealTeams` the draw carries on past the first Ace to a second, and those two
 * players become partners — so the pairing comes out of the cards rather than the
 * seating. The other two are partners by elimination.
 *
 * `random` skips the ceremony: a Hâkem is picked and no cards are turned.
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
      teamOfSeat: teamsBySeat(),
    };
  }

  const reveals: HakemReveal[] = [];
  let hakemSeat: Seat | null = null;
  let partnerSeat: Seat | null = null;

  for (let i = 0; i < deck.length; i++) {
    const seat = ((startSeat + i) % 4) as Seat;
    const card = deck[i];
    reveals.push({ seat, card });

    if (card.rank !== 'A') continue;

    if (hakemSeat === null) {
      hakemSeat = seat;
      // On the seat-based pairing the draw is over the moment the Hâkem is known;
      // there's no partner to find, because the seating already settled it.
      if (mode === 'aceDealSeats') break;
      continue;
    }

    // A second Ace to the same player tells us nothing — keep dealing until it
    // lands on one of the other three.
    if (seat === hakemSeat) continue;

    partnerSeat = seat;
    break;
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

  const teamOfSeat = teamsBySeat();
  if (partnerSeat !== null) {
    const hakemTeam = teamOfSeat[hakemSeat];
    const opposing = (1 - hakemTeam) as Team;
    for (let seat = 0; seat < 4; seat++) {
      teamOfSeat[seat] = seat === hakemSeat || seat === partnerSeat ? hakemTeam : opposing;
    }
  }

  return { reveals, hakemSeat, partnerSeat, teamOfSeat };
}
