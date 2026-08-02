import { AnimatePresence, motion } from 'framer-motion';
import type { Card as CardModel, Seat as SeatIndex, Suit } from '@shelem/shared';
import styles from './TrickArea.module.css';
import { Card } from './Card.js';

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

export function TrickArea({ mySeat, plays, trumpSuit }: TrickAreaProps) {
  return (
    <div className={styles.area}>
      {trumpSuit && <div className={styles.trumpBadge}>Trump: {SUIT_LABEL[trumpSuit]}</div>}
      <AnimatePresence>
        {plays.map(({ seat, card }) => (
          <motion.div
            key={`${card.suit}-${card.rank}`}
            className={`${styles.slot} ${styles[screenSlotFor(seat, mySeat)]}`}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <Card card={card} size="md" />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
