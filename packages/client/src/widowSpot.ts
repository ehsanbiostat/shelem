import type { Seat as SeatIndex } from '@shelem/shared';
import { screenSlotFor, type ScreenSlot } from './screenSlot.js';
import type { TableMetrics } from './tableMetrics.js';

export interface WidowSpot {
  /** Offset from the middle of the felt, in px — the same origin the dealing
   * overlay's flyers use (`.deck` is pinned at top/left 50%). */
  x: number;
  y: number;
  /** Degrees, matching how a seat's own cards lie on the table. */
  rotate: number;
}

/** How far a seat's own cards land inside their edge, in `u`. The dealing
 * overlay has always used 7 — the widow parks inboard of that, between the
 * player's cards and the middle of the table. */
const SEAT_INSET_U = 7;

/** Extra inset for the widow pile, per screen slot, in `u`.
 *
 * The bottom is a special case rather than an oversight: it's the local player's
 * own place, and the bottom 17.5u of the felt is spoken for — that multiple is the
 * height of the hand strip, the seat label just above it, and `.center`'s own
 * bottom inset, all deliberately kept in step (see Hand.module.css). A pile parked
 * as close to that edge as the other three are to theirs would sit underneath the
 * player's own cards. 7 + 22 = 29u puts its lowest corner ~24.5u up, clear of all
 * three with room to spare. */
const PILE_INSET_U: Record<ScreenSlot, number> = {
  top: 11,
  left: 11,
  right: 11,
  bottom: 22,
};

/** Which way up the pile lies for each slot — a seat's cards face that seat, so
 * the pile does too. Same table as the dealing overlay's per-slot rotation. */
const ROTATION: Record<ScreenSlot, number> = {
  bottom: 0,
  top: 180,
  left: -90,
  right: 90,
};

/**
 * Where the four widow cards sit for a given seat: in front of them, face-down,
 * between their own cards and the middle of the table.
 *
 * Shared by the dealing overlay (which flies the widow here as the last block of
 * the deal) and WidowPile (which then mounts here, and flies from the dealer's
 * spot to the winning bidder's). Both have to agree to the pixel or the pile
 * would visibly jump at the moment the deal hands over to it — the same reason
 * `screenSlotFor` is shared rather than redefined per component.
 */
export function widowSpot(seat: SeatIndex, mySeat: SeatIndex, metrics: TableMetrics): WidowSpot {
  const { width, height, u } = metrics;
  const slot = screenSlotFor(seat, mySeat);
  const inset = (SEAT_INSET_U + PILE_INSET_U[slot]) * u;
  const rotate = ROTATION[slot];

  if (slot === 'top') return { x: 0, y: -(height / 2 - inset), rotate };
  if (slot === 'bottom') return { x: 0, y: height / 2 - inset, rotate };
  if (slot === 'left') return { x: -(width / 2 - inset), y: 0, rotate };
  return { x: width / 2 - inset, y: 0, rotate };
}
