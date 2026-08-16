import { describe, expect, it } from 'vitest';
import {
  COUNTDOWN_TICK_SECONDS,
  countdownTickSecond,
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

describe('countdownTickSecond', () => {
  it('names the second the way a person would', () => {
    // 4.2 seconds left is "five", not "four" — you say the number you are counting
    // down *from*.
    expect(countdownTickSecond(4200)).toBe(5);
    expect(countdownTickSecond(5000)).toBe(5);
    expect(countdownTickSecond(3001)).toBe(4);
    expect(countdownTickSecond(1)).toBe(1);
  });

  it('stays silent until the countdown window', () => {
    expect(countdownTickSecond(5001)).toBeNull();
    expect(countdownTickSecond(30_000)).toBeNull();
  });

  it('stays silent at and past zero', () => {
    // By then the turn has been played; a tick would announce something that has
    // already happened.
    expect(countdownTickSecond(0)).toBeNull();
    expect(countdownTickSecond(-500)).toBeNull();
  });

  it('sounds every second exactly once across a whole countdown', () => {
    // The one that matters. The caller polls this ~60 times a second, so a
    // boundary landing on the wrong side means a second ticks twice or is skipped
    // — and neither is obvious by ear until it is annoying.
    const fired: number[] = [];
    let last: number | null = null;

    for (let remaining = 7000; remaining >= -200; remaining -= 1) {
      const second = countdownTickSecond(remaining);
      if (second !== null && second !== last) fired.push(second);
      last = second;
    }

    expect(fired).toEqual([5, 4, 3, 2, 1]);
  });

  it('covers the whole turn on a table set to the shortest limit', () => {
    // Deliberate: at a five-second limit the entire turn is the last five seconds.
    expect(COUNTDOWN_TICK_SECONDS).toBe(MIN_TURN_LIMIT_SECONDS);
    expect(countdownTickSecond(MIN_TURN_LIMIT_SECONDS * 1000)).toBe(COUNTDOWN_TICK_SECONDS);
  });
});
