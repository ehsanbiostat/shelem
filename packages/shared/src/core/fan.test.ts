import { describe, expect, it } from 'vitest';
import { fanAngles } from './fan.js';

describe('fanAngles', () => {
  it('returns an empty arc for zero cards', () => {
    expect(fanAngles(0)).toEqual([]);
  });

  it('a single card points straight (0deg)', () => {
    expect(fanAngles(1)).toEqual([0]);
  });

  it('returns exactly one angle per card, for every count from 0 to 20', () => {
    for (let n = 0; n <= 20; n++) {
      expect(fanAngles(n)).toHaveLength(n);
    }
  });

  it('is symmetric around 0deg', () => {
    for (const n of [2, 3, 4, 5, 8, 12, 16, 20]) {
      const angles = fanAngles(n);
      for (let i = 0; i < n; i++) {
        expect(angles[i]).toBeCloseTo(-angles[n - 1 - i], 10);
      }
    }
  });

  it('spaces every adjacent pair by the exact same angle (a true arc, not an approximation)', () => {
    for (const n of [2, 3, 5, 8, 12, 16, 20]) {
      const angles = fanAngles(n);
      const gaps = angles.slice(1).map((angle, i) => angle - angles[i]);
      for (const gap of gaps) {
        expect(gap).toBeCloseTo(gaps[0], 10);
      }
    }
  });

  it('is strictly increasing left to right (no folded-over or out-of-order cards)', () => {
    for (const n of [2, 3, 5, 8, 12, 16]) {
      const angles = fanAngles(n);
      for (let i = 1; i < n; i++) {
        expect(angles[i]).toBeGreaterThan(angles[i - 1]);
      }
    }
  });

  it('grows the spread proportionally to card count while under the cap', () => {
    // 5 cards * 4deg/gap * 4 gaps = 16deg total spread, well under the default 50deg cap.
    const angles = fanAngles(5);
    expect(angles[0]).toBeCloseTo(-8, 10);
    expect(angles[4]).toBeCloseTo(8, 10);
  });

  it('caps the total spread for large hands instead of fanning past a sane angle', () => {
    // 16 cards (a declarer's widow pickup) * 4deg would be 60deg — capped to 50deg.
    const angles = fanAngles(16);
    expect(angles[0]).toBeCloseTo(-25, 10);
    expect(angles[15]).toBeCloseTo(25, 10);
  });

  it('never exceeds the configured max spread, for any count', () => {
    for (let n = 2; n <= 30; n++) {
      const angles = fanAngles(n);
      const spread = angles[angles.length - 1] - angles[0];
      expect(spread).toBeLessThanOrEqual(50 + 1e-9);
    }
  });

  it('honors custom degreesPerCard and maxSpread overrides', () => {
    const angles = fanAngles(4, 10, 20);
    // 3 gaps * 10deg = 30deg, capped to 20deg.
    expect(angles[0]).toBeCloseTo(-10, 10);
    expect(angles[3]).toBeCloseTo(10, 10);
  });

  it('re-fanning after adding or removing a card still produces a valid, evenly spaced arc', () => {
    // The function is stateless — every count is recomputed from scratch — so
    // there's no way for a sequence of insertions/removals to leave the arc
    // unevenly spaced or asymmetric, unlike an approach that nudges existing
    // card positions incrementally. Simulate a hand shrinking one play at a time.
    for (let n = 12; n >= 1; n--) {
      const angles = fanAngles(n);
      expect(angles).toHaveLength(n);
      if (n > 1) {
        const gaps = angles.slice(1).map((angle, i) => angle - angles[i]);
        expect(Math.max(...gaps) - Math.min(...gaps)).toBeCloseTo(0, 10);
      }
    }
  });
});
