import type { Seat } from '../core/types.js';
import type { Bid, BidEvent } from './types.js';

export const BID_FLOOR = 100;
export const BID_CAP = 160;
export const BID_INCREMENT = 5;

const SHELEM_RANK = 1000;
const SAR_SHELEM_RANK = 2000;

/** Comparable rank for any bid. Numeric bids rank by amount (100-160); Shelem and
 * Sar-Shelem always outrank every numeric bid, and Sar-Shelem outranks Shelem. */
export function bidRank(bid: Bid): number {
  switch (bid.type) {
    case 'numeric':
      return bid.amount;
    case 'shelem':
      return SHELEM_RANK;
    case 'sarShelem':
      return SAR_SHELEM_RANK;
    case 'pass':
      return -Infinity;
  }
}

/**
 * Is `bid` a legal next bid given the current highest standing bid (null if no one
 * has bid yet this hand)? A `pass` is always legal for an active (non-passed) seat.
 */
export function isValidBid(bid: Bid, currentHighest: Bid | null): boolean {
  if (bid.type === 'pass') return true;

  if (bid.type === 'numeric') {
    if (bid.amount % BID_INCREMENT !== 0) return false;
    if (bid.amount < BID_FLOOR || bid.amount > BID_CAP) return false;
  }

  if (currentHighest && bidRank(bid) <= bidRank(currentHighest)) return false;

  return true;
}

/** Consecutive passes with no bid on the table that end the auction and force a
 * redeal. Three, not four: once three seats have passed without anyone opening,
 * the hand is dead and the fourth seat doesn't get a turn. */
export const PASSES_TO_REDEAL = 3;

export interface BiddingResolution {
  complete: boolean;
  /** True when the auction died without a bid — see PASSES_TO_REDEAL. */
  redeal: boolean;
  declarerSeat?: Seat;
  winningBid?: Bid;
}

/**
 * Walks the sequence of bid events (in order) for a hand's auction and determines
 * whether bidding is complete, and if so, who won it. Caller is responsible for only
 * feeding in events that already passed `isValidBid` and for driving turn order —
 * this function is a pure reduction over the event log.
 */
export function resolveBidding(events: BidEvent[]): BiddingResolution {
  const passedSeats = new Set<Seat>();
  let highestBid: Bid | null = null;
  let highestBidSeat: Seat | null = null;
  let anyBidMade = false;

  for (const event of events) {
    if (event.bid.type === 'pass') {
      passedSeats.add(event.seat);
      continue;
    }
    anyBidMade = true;
    highestBid = event.bid;
    highestBidSeat = event.seat;
    // A new bid re-opens the auction for anyone who wasn't the bidder; only an
    // explicit pass event removes a seat from contention.
    passedSeats.delete(event.seat);
  }

  // No bid on the table means every event so far was a pass, so the count is
  // necessarily a run of consecutive ones. Checked before the last-active-bidder
  // rule below, which needs a bid to have been made anyway.
  if (!anyBidMade && passedSeats.size >= PASSES_TO_REDEAL) {
    return { complete: true, redeal: true };
  }

  const activeSeats = 4 - passedSeats.size;
  if (activeSeats === 1 && anyBidMade && highestBidSeat !== null && highestBid) {
    return { complete: true, redeal: false, declarerSeat: highestBidSeat, winningBid: highestBid };
  }

  return { complete: false, redeal: false };
}
