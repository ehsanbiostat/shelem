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

/** Where an opponent's card visually flies in from, offset from its final
 * position — there's no real source element for their (face-down) card the way
 * there is for our own hand, so this fakes "it came from that seat" directionally
 * instead of the true shared-element flight our own plays get (see `layoutId`
 * below). In multiples of the shared `--u` scale unit (theme.css), like every
 * other distance on the table — as fixed px these were the one thing that didn't
 * shrink with the board, so on a phone a card flew in from well off-screen. */
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
          const isMine = seat === mySeat;
          // Our own card shares a layoutId with its instance in Hand.tsx — Framer
          // Motion detects the matching id disappearing from the hand and appearing
          // here, and animates a real flight between the two positions (a "shared
          // layout" / FLIP animation) instead of a plain fade. Opponents' cards
          // have no such source element (we never render their actual card before
          // it's played), so they get a directional fly-in from their seat instead.
          const flyInU = isMine ? null : FLY_IN_OFFSET_U[slot];
          const flyIn = flyInU && { x: flyInU.x * u, y: flyInU.y * u };
          return (
            <motion.div
              key={cardKey(card)}
              layoutId={isMine ? cardKey(card) : undefined}
              className={`${styles.slot} ${styles[slot]}`}
              initial={{
                opacity: 0,
                scale: 0.6,
                rotate: FACE_ROTATION[slot],
                ...(flyIn && { x: flyIn.x, y: flyIn.y }),
              }}
              animate={{ opacity: 1, scale: 1, rotate, ...(flyIn && { x: 0, y: 0 }) }}
              exit={{ opacity: 0, scale: 0.6 }}
              // A spring rather than a fixed-duration tween: our own card is doing a
              // real shared-element flight from the hand (see `layoutId` above), and a
              // spring carries its momentum into the landing instead of stopping dead
              // at the end of a curve. Opponents' cards only fade in from a direction,
              // so they keep a short tween — a spring on a 100px fade reads as wobble.
              transition={
                isMine
                  ? { type: 'spring', stiffness: 200, damping: 26, mass: 0.9 }
                  : { duration: 0.28, ease: 'easeOut' }
              }
            >
              <Card card={card} size="lg" />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
