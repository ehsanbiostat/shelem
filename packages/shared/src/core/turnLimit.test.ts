import { describe, expect, it } from 'vitest';
import {
  DEAL_ALLOWANCE_MS,
  DEFAULT_TURN_LIMIT_SECONDS,
  MAX_TURN_LIMIT_SECONDS,
  MIN_TURN_LIMIT_SECONDS,
  TURN_LIMIT_OFF,
  turnDurationMs,
  validateTurnLimit,
} from './turnLimit.js';

describe('validateTurnLimit', () => {
  it('accepts a whole number of seconds in range', () => {
    expect(validateTurnLimit(MIN_TURN_LIMIT_SECONDS)).toBeNull();
    expect(validateTurnLimit(30)).toBeNull();
    expect(validateTurnLimit(MAX_TURN_LIMIT_SECONDS)).toBeNull();
  });

  it('accepts zero, which turns the clock off', () => {
    expect(validateTurnLimit(TURN_LIMIT_OFF)).toBeNull();
  });

  it('rejects a limit too short to be a limit', () => {
    // Below a few seconds a clock stops being a limit and becomes a reflex test.
    expect(validateTurnLimit(MIN_TURN_LIMIT_SECONDS - 1)).toMatch(/between/);
  });

  it('rejects a limit past the ceiling, and anything that is not a whole second', () => {
    expect(validateTurnLimit(MAX_TURN_LIMIT_SECONDS + 1)).toMatch(/between/);
    expect(validateTurnLimit(12.5)).toMatch(/whole number/);
    expect(validateTurnLimit('30')).toMatch(/whole number/);
    expect(validateTurnLimit(NaN)).toMatch(/whole number/);
  });

  it('rejects a negative, rather than reading it as off', () => {
    expect(validateTurnLimit(-1)).toMatch(/between/);
  });
});

describe('turnDurationMs', () => {
  it('gives an ordinary turn the plain limit', () => {
    expect(turnDurationMs(30)).toBe(30_000);
  });

  it('gives twice as long to a decision worth deliberating over', () => {
    // Choosing a bid or naming trump off five cards is a judgement; following
    // suit usually is not.
    expect(turnDurationMs(30, { deliberate: true })).toBe(60_000);
  });

  it('adds the deal animation to the first decision of a hand', () => {
    // The server hands the turn over the moment it deals, but the client is still
    // animating; without this the first player loses that time to the clock.
    expect(turnDurationMs(30, { firstOfHand: true })).toBe(30_000 + DEAL_ALLOWANCE_MS);
  });

  it('combines both allowances for an opening bid', () => {
    expect(turnDurationMs(30, { deliberate: true, firstOfHand: true })).toBe(
      60_000 + DEAL_ALLOWANCE_MS,
    );
  });

  it('returns zero when the clock is off, whatever else is asked for', () => {
    // Zero is the signal that no timer should be armed at all — not a very short one.
    expect(turnDurationMs(TURN_LIMIT_OFF)).toBe(0);
    expect(turnDurationMs(TURN_LIMIT_OFF, { deliberate: true, firstOfHand: true })).toBe(0);
  });

  it('is on by default, because a clock nobody enables solves nothing', () => {
    expect(DEFAULT_TURN_LIMIT_SECONDS).toBe(30);
  });
});
