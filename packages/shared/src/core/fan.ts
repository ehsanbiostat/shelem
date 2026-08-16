/** Degrees between adjacent cards for a typical hand. */
export const FAN_DEGREES_PER_CARD = 4;
/** Cap on the total spread so a big hand (e.g. the declarer's 16-card widow pickup)
 * doesn't fan out past a sane angle. */
export const FAN_MAX_TOTAL_SPREAD = 50;

/**
 * Evenly-spaced rotation angles (in degrees) for fanning `total` cards into an arc,
 * symmetric around 0. Used for both the local player's hand and every opponent's
 * face-down fan, so every seat's cards read as the same shape.
 *
 * This is a pure function of `total` — every render recomputes the full set of
 * angles from scratch, so there's no accumulated state to drift as cards are added
 * or removed. Combined with a stable per-card key, this means the arc stays evenly
 * spaced and symmetric no matter how many cards come and go, or in what order —
 * it's the actual shape (angles must be evenly spaced, symmetric, and within the
 * spread cap) that's the invariant worth guaranteeing, not any particular sequence
 * of intermediate states.
 */
export function fanAngles(total: number, degreesPerCard: number = FAN_DEGREES_PER_CARD, maxSpread: number = FAN_MAX_TOTAL_SPREAD): number[] {
  if (total <= 0) return [];
  if (total === 1) return [0];

  const spread = Math.min(maxSpread, (total - 1) * degreesPerCard);
  const step = spread / (total - 1);
  return Array.from({ length: total }, (_, i) => -spread / 2 + step * i);
}
