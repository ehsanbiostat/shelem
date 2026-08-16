import type { CommonPhase, Seat } from '../core/types.js';

export type NumericBid = { type: 'numeric'; amount: number };
export type ShelemBid = { type: 'shelem' };
export type SarShelemBid = { type: 'sarShelem' };
export type PassBid = { type: 'pass' };

export type Bid = NumericBid | ShelemBid | SarShelemBid | PassBid;

export interface BidEvent {
  seat: Seat;
  bid: Bid;
}

/** The common phases plus the two Shelem adds: its auction, and the declarer's
 * widow pickup and discard. */
export type ShelemPhase = CommonPhase | 'bidding' | 'widow';
