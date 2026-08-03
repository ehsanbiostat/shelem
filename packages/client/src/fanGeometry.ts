/** Computes the per-card horizontal spacing (px) for an evenly-overlapping fan
 * of `count` cards, capped so the whole fan is guaranteed to fit within
 * `availableSpace`.
 *
 * Position here comes from spacing, not from rotation — an earlier version
 * (twice) derived each card's position by rotating it around a pivot point far
 * above/below it, which reads as an elegant "equal angle steps land equal
 * arc-length apart" arc, but has an unavoidable side effect: rotating around a
 * distant pivot doesn't just move a card sideways, it also shifts it
 * *perpendicular* to that by an amount that grows with the angle. Widening the
 * pivot distance to fill more of the available spread space made that
 * perpendicular shift worse, and for a seat that hugs the true screen edge
 * (see Seat.module.css) there's very little perpendicular clearance before
 * that shift pushes a card off-screen — which is exactly how "still not all
 * visible" kept recurring across two rounds of fixing the spread-fits math
 * while the perpendicular one silently didn't. Plain horizontal spacing has no
 * such side effect: a card's position depends only on its own offset, so
 * capping total spread to fit is a one-line guarantee instead of two competing
 * trig constraints that can conflict. The small rotation each card still gets
 * (see fanAngles) is now purely cosmetic — applied around the card's own
 * center, with zero effect on where it actually sits. */
export function fitSpacing(
  availableSpace: number,
  cardThickness: number,
  count: number,
  desiredSpacing: number,
  marginFactor = 0.94,
): number {
  if (count <= 1) return 0;
  const maxSpacing = (availableSpace * marginFactor - cardThickness) / (count - 1);
  return Math.max(0, Math.min(desiredSpacing, maxSpacing));
}

/** Horizontal offsets (px), centered on 0, for `count` cards `spacing` apart. */
export function fanOffsets(count: number, spacing: number): number[] {
  if (count <= 0) return [];
  const center = (count - 1) / 2;
  return Array.from({ length: count }, (_, i) => (i - center) * spacing);
}

/** Perpendicular (depth) offset per card, in the same local "negative = further
 * into the table" direction as the crop reveal (Seat.module.css's
 * .fanCardCrop pins each card to its own bottom, i.e. local-negative-Y is
 * where the visible slice sits) — a parabola that's 0 at the two outermost
 * cards and `-curveAmount` (further into the table) at dead center, so the
 * fan reads as a shallow dome bulging toward the table rather than a flat row
 * or, worse, a bowl sagging away from it. Purely cosmetic, layered on top of
 * `fanOffsets` — has no bearing on whether the fan fits. */
export function fanCurve(offsets: number[], curveAmount: number): number[] {
  const maxAbs = offsets.reduce((m, o) => Math.max(m, Math.abs(o)), 0);
  if (maxAbs <= 0 || curveAmount <= 0) return offsets.map(() => 0);
  return offsets.map((o) => -curveAmount * (1 - (o / maxAbs) ** 2));
}
