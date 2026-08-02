import { AnimatePresence, motion } from 'framer-motion';
import type { Card as CardModel } from '@shelem/shared';
import styles from './Hand.module.css';
import { Card } from './Card.js';

export interface HandProps {
  cards: CardModel[];
  legalCards: CardModel[];
  isMyTurn: boolean;
  onPlay: (card: CardModel) => void;
  selectedCard: CardModel | null;
}

function cardsEqual(a: CardModel, b: CardModel): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

/** The local player's own hand, fanned out and clickable. Cards not in `legalCards`
 * are shown but disabled — matches the rule that you can see why a card can't be
 * played (didn't follow suit / no trump) rather than hiding options silently. */
export function Hand({ cards, legalCards, isMyTurn, onPlay, selectedCard }: HandProps) {
  const total = cards.length;

  return (
    <div className={styles.hand}>
      <AnimatePresence>
        {cards.map((card, i) => {
          const angle = total > 1 ? (i - (total - 1) / 2) * Math.min(6, 40 / total) : 0;
          const playable = isMyTurn && legalCards.some((c) => cardsEqual(c, card));
          const selected = !!selectedCard && cardsEqual(selectedCard, card);
          return (
            <motion.div
              key={`${card.suit}-${card.rank}`}
              className={styles.cardSlot}
              style={{ transform: `rotate(${angle}deg)` }}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              layout
            >
              <Card card={card} size="lg" playable={playable} selected={selected} onClick={() => onPlay(card)} />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
