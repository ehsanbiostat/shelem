export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';

export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
}

/** Seats 0 and 2 are partners; seats 1 and 3 are partners. */
export type Seat = 0 | 1 | 2 | 3;

/** Team 0 = seats 0 & 2. Team 1 = seats 1 & 3. */
export type Team = 0 | 1;

export function teamForSeat(seat: Seat): Team {
  return (seat % 2) as Team;
}

/**
 * How the deck for each hand after the first is produced.
 *
 * - `table` — last hand's cards, gathered up and given a light shuffle, which is what
 *   carries suit grouping from one hand into the next (see docs/game-rules.md). The
 *   way the game is played at a real table, and Shelem's default.
 * - `random` — a fresh, fully randomised deck every hand.
 */
export type ShuffleMode = 'table' | 'random';

/**
 * The phases every game on the platform passes through, whatever it is. Each game
 * widens this with its own — see ShelemPhase and HokmPhase — so the shared table
 * plumbing (lobby, seat swap, rematch) can reason about a phase without knowing
 * which game it belongs to.
 */
export type CommonPhase =
  | 'configuring' // between matches: the new host is setting the rules for the next one
  | 'lobby' // waiting for 4 seats to fill; seat-swap requests allowed here
  | 'dealing'
  | 'playing'
  | 'handComplete'
  | 'matchComplete';
