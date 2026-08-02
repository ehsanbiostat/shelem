import { AnimatePresence, motion } from 'framer-motion';
import type { Card as CardModel, Seat as SeatIndex, Suit } from '@shelem/shared';
import styles from './TrickArea.module.css';
import { Card } from './Card.js';
import { cardKey } from '../cardKey.js';

export interface TrickPlayItem {
  seat: SeatIndex;
  card: CardModel;
}

export interface TrickAreaProps {
  mySeat: SeatIndex;
  plays: TrickPlayItem[];
  trumpSuit: Suit | null;
}

const SUIT_LABEL: Record<Suit, string> = {
  spades: 'Spades',
  hearts: 'Hearts',
  diamonds: 'Diamonds',
  clubs: 'Clubs',
};

function screenSlotFor(seat: SeatIndex, mySeat: SeatIndex): 'bottom' | 'left' | 'top' | 'right' {
  const offset = ((seat - mySeat + 4) % 4) as 0 | 1 | 2 | 3;
  return (['bottom', 'left', 'top', 'right'] as const)[offset];
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

/** Where an opponent's card visually flies in from, in px offset from its final
 * position — there's no real source element for their (face-down) card the way
 * there is for our own hand, so this fakes "it came from that seat" directionally
 * instead of the true shared-element flight our own plays get (see `layoutId`
 * below). */
const FLY_IN_OFFSET: Record<'top' | 'bottom' | 'left' | 'right', { x: number; y: number }> = {
  top: { x: 0, y: -140 },
  bottom: { x: 0, y: 140 },
  left: { x: -180, y: 0 },
  right: { x: 180, y: 0 },
};

export function TrickArea({ mySeat, plays, trumpSuit }: TrickAreaProps) {
  return (
    <div className={styles.area}>
      {trumpSuit && <div className={styles.trumpBadge}>Trump: {SUIT_LABEL[trumpSuit]}</div>}
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
          const flyIn = isMine ? null : FLY_IN_OFFSET[slot];
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
              transition={{ duration: isMine ? 0.35 : 0.28, ease: 'easeOut' }}
            >
              <Card card={card} size="md" />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
