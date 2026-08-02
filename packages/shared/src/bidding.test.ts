import { describe, expect, it } from 'vitest';
import { isValidBid, resolveBidding } from './bidding.js';
import type { Bid, BidEvent } from './types.js';

describe('isValidBid', () => {
  it('allows an opening numeric bid anywhere from 100 to 160 in multiples of 5', () => {
    expect(isValidBid({ type: 'numeric', amount: 100 }, null)).toBe(true);
    expect(isValidBid({ type: 'numeric', amount: 145 }, null)).toBe(true);
    expect(isValidBid({ type: 'numeric', amount: 160 }, null)).toBe(true);
  });

  it('rejects an opening numeric bid below 100 or above 160', () => {
    expect(isValidBid({ type: 'numeric', amount: 95 }, null)).toBe(false);
    expect(isValidBid({ type: 'numeric', amount: 165 }, null)).toBe(false);
  });

  it('rejects a numeric bid that is not a multiple of 5', () => {
    expect(isValidBid({ type: 'numeric', amount: 107 }, null)).toBe(false);
  });

  it('allows opening straight into Shelem or Sar-Shelem without any numeric bid first', () => {
    expect(isValidBid({ type: 'shelem' }, null)).toBe(true);
    expect(isValidBid({ type: 'sarShelem' }, null)).toBe(true);
  });

  it('allows any raise size in multiples of 5, not just +5', () => {
    const current: Bid = { type: 'numeric', amount: 100 };
    expect(isValidBid({ type: 'numeric', amount: 105 }, current)).toBe(true);
    expect(isValidBid({ type: 'numeric', amount: 130 }, current)).toBe(true);
    expect(isValidBid({ type: 'numeric', amount: 160 }, current)).toBe(true);
  });

  it('rejects a numeric bid that does not exceed the current highest', () => {
    const current: Bid = { type: 'numeric', amount: 120 };
    expect(isValidBid({ type: 'numeric', amount: 120 }, current)).toBe(false);
    expect(isValidBid({ type: 'numeric', amount: 115 }, current)).toBe(false);
  });

  it('Shelem outranks any numeric bid, Sar-Shelem outranks Shelem', () => {
    const numeric160: Bid = { type: 'numeric', amount: 160 };
    expect(isValidBid({ type: 'shelem' }, numeric160)).toBe(true);
    expect(isValidBid({ type: 'sarShelem' }, numeric160)).toBe(true);

    const shelem: Bid = { type: 'shelem' };
    expect(isValidBid({ type: 'sarShelem' }, shelem)).toBe(true);
    expect(isValidBid({ type: 'shelem' }, shelem)).toBe(false);
  });

  it('nothing can out-bid a numeric bid once Shelem or Sar-Shelem has been called', () => {
    const shelem: Bid = { type: 'shelem' };
    expect(isValidBid({ type: 'numeric', amount: 160 }, shelem)).toBe(false);

    const sarShelem: Bid = { type: 'sarShelem' };
    expect(isValidBid({ type: 'shelem' }, sarShelem)).toBe(false);
    expect(isValidBid({ type: 'numeric', amount: 160 }, sarShelem)).toBe(false);
  });

  it('a pass is always valid regardless of the current highest bid', () => {
    expect(isValidBid({ type: 'pass' }, null)).toBe(true);
    expect(isValidBid({ type: 'pass' }, { type: 'sarShelem' })).toBe(true);
  });
});

describe('resolveBidding', () => {
  it('redeals if every player passes with no bid ever made', () => {
    const events: BidEvent[] = [
      { seat: 0, bid: { type: 'pass' } },
      { seat: 1, bid: { type: 'pass' } },
      { seat: 2, bid: { type: 'pass' } },
      { seat: 3, bid: { type: 'pass' } },
    ];
    const result = resolveBidding(events);
    expect(result.complete).toBe(true);
    expect(result.redeal).toBe(true);
  });

  it('is incomplete while more than one seat is still active', () => {
    const events: BidEvent[] = [
      { seat: 0, bid: { type: 'numeric', amount: 100 } },
      { seat: 1, bid: { type: 'pass' } },
    ];
    const result = resolveBidding(events);
    expect(result.complete).toBe(false);
  });

  it('declares the last active bidder as declarer once the other three pass', () => {
    const events: BidEvent[] = [
      { seat: 0, bid: { type: 'numeric', amount: 100 } },
      { seat: 1, bid: { type: 'numeric', amount: 110 } },
      { seat: 2, bid: { type: 'pass' } },
      { seat: 3, bid: { type: 'pass' } },
      { seat: 0, bid: { type: 'pass' } },
    ];
    const result = resolveBidding(events);
    expect(result.complete).toBe(true);
    expect(result.redeal).toBe(false);
    expect(result.declarerSeat).toBe(1);
    expect(result.winningBid).toEqual({ type: 'numeric', amount: 110 });
  });

  it('resolves a Sar-Shelem call as the winning bid', () => {
    const events: BidEvent[] = [
      { seat: 0, bid: { type: 'numeric', amount: 100 } },
      { seat: 1, bid: { type: 'sarShelem' } },
      { seat: 2, bid: { type: 'pass' } },
      { seat: 3, bid: { type: 'pass' } },
      { seat: 0, bid: { type: 'pass' } },
    ];
    const result = resolveBidding(events);
    expect(result.complete).toBe(true);
    expect(result.declarerSeat).toBe(1);
    expect(result.winningBid).toEqual({ type: 'sarShelem' });
  });
});
