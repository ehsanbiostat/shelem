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

export type NumericBid = { type: 'numeric'; amount: number };
export type ShelemBid = { type: 'shelem' };
export type SarShelemBid = { type: 'sarShelem' };
export type PassBid = { type: 'pass' };

export type Bid = NumericBid | ShelemBid | SarShelemBid | PassBid;

export interface BidEvent {
  seat: Seat;
  bid: Bid;
}

export type GamePhase =
  | 'configuring' // between matches: the new host is setting the rules for the next one
  | 'lobby' // waiting for 4 seats to fill; seat-swap requests allowed here
  | 'dealing'
  | 'bidding'
  | 'widow' // declarer picking up widow and discarding
  | 'playing'
  | 'handComplete'
  | 'matchComplete';
