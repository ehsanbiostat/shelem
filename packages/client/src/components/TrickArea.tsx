import { AnimatePresence, motion } from 'framer-motion';
import type { Card as CardModel, Seat as SeatIndex } from '@shelem/shared';
import styles from './TrickArea.module.css';
import { Card } from './Card.js';
import { cardKey } from '../cardKey.js';
import { useTableMetrics } from '../tableMetrics.js';
import { screenSlotFor } from '../screenSlot.js';

export interface TrickPlayItem {
  seat: SeatIndex;
  card: CardModel;
}

export interface TrickAreaProps {
  mySeat: SeatIndex;
  plays: TrickPlayItem[];
}

/** A card played from a given seat is left oriented as that player set it down —
 * upright from their own seat, not ours — so its rotation alone tells you who
 * played it: our own cards read normally, the opposite seat's read upside down,
 * and the side seats read sideways. */
const FACE_ROTATION: Record<'top' | 'bottom' | 'left' | 'right', number> = {
  bottom: 0,
  top: 180,
  left: 90,
  right: -90,
};

/** Small extra tilt on top of the facing rotation, so the pile reads as tossed
 * cards rather than four precision-aligned tiles. */
const TILT: Record<'top' | 'bottom' | 'left' | 'right', number> = {
  top: -4,
  bottom: 4,
  left: -4,
  right: 4,
};

/** Where a card visually flies in from, offset from its final position, so it
 * reads as having come from its player's seat. In multiples of the shared `--u`
 * scale unit (theme.css), like every other distance on the table — as fixed px
 * these were the one thing that didn't shrink with the board, so on a phone a
 * card flew in from well off-screen. */
const FLY_IN_OFFSET_U: Record<'top' | 'bottom' | 'left' | 'right', { x: number; y: number }> = {
  top: { x: 0, y: -22 },
  bottom: { x: 0, y: 22 },
  left: { x: -28, y: 0 },
  right: { x: 28, y: 0 },
};

export function TrickArea({ mySeat, plays }: TrickAreaProps) {
  const { u } = useTableMetrics();

  return (
    <div className={styles.area}>
      <AnimatePresence>
        {plays.map(({ seat, card }) => {
          const slot = screenSlotFor(seat, mySeat);
          const rotate = FACE_ROTATION[slot] + TILT[slot];
          // Every card, ours included, flies in from its own seat. Our own used to
          // ride a `layoutId` shared-element flight from the hand, which Motion
          // implements as FLIP — and FLIP interpolates *axis-aligned bounding
          // boxes*. A card leaves the hand at a fan angle of up to ±32° and lands
          // rotated 0/90/180/-90 for its seat, so the two boxes describe different
          // shapes and the tween between them followed neither: that mismatch was
          // the visible pop, and no spring tuning could remove it. Motion's docs
          // give no guidance on combining rotation with layout animations, and
          // separately warn that layout changes shouldn't come from `animate` at
          // all — which is exactly what the fan does. Animating explicitly costs
          // the true point-of-origin flight and buys a transform-and-opacity-only
          // move that is correct at both ends.
          const flyInU = FLY_IN_OFFSET_U[slot];
          const flyIn = { x: flyInU.x * u, y: flyInU.y * u };
          return (
            <motion.div
              key={cardKey(card)}
              className={`${styles.slot} ${styles[slot]}`}
              initial={{ opacity: 0, scale: 0.86, rotate: FACE_ROTATION[slot], x: flyIn.x, y: flyIn.y }}
              animate={{ opacity: 1, scale: 1, rotate, x: 0, y: 0 }}
              exit={{ opacity: 0, scale: 0.6 }}
              // One spring for every card, so all four land the same way. Damped
              // close to critical: enough to carry momentum into the landing,
              // not enough to overshoot and wobble, which on a short travel
              // distance reads as a glitch rather than as weight.
              transition={{ type: 'spring', stiffness: 210, damping: 27, mass: 0.85 }}
            >
              <Card card={card} size="lg" />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
