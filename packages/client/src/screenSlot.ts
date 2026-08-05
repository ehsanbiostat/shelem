import type { Seat as SeatIndex } from '@shelem/shared';

export type ScreenSlot = 'bottom' | 'left' | 'top' | 'right';

/** Screen position for a seat relative to the local player, who is always drawn
 * at the bottom. Turn order is clockwise, so the next seat appears on-screen left
 * (standard 4-player card table convention).
 *
 * Shared rather than redefined per component: the table's seats, the live trick,
 * and the last-trick review all have to agree on where a given player sits, or a
 * card would appear to come from a different seat depending on which view you're
 * looking at. */
export function screenSlotFor(seat: SeatIndex, mySeat: SeatIndex): ScreenSlot {
  const offset = ((seat - mySeat + 4) % 4) as 0 | 1 | 2 | 3;
  return (['bottom', 'left', 'top', 'right'] as const)[offset];
}
