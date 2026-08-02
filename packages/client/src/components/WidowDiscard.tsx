import { useState } from 'react';
import type { Card as CardModel } from '@shelem/shared';
import styles from './WidowDiscard.module.css';
import { Card } from './Card.js';

export interface WidowDiscardProps {
  cards: CardModel[];
  onDiscard: (cards: CardModel[]) => void;
}

function cardsEqual(a: CardModel, b: CardModel): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

/** Declarer picked up the widow (16 cards) and must discard exactly 4 back down to 12.
 * Those 4 become the team's first trick, so this choice matters. */
export function WidowDiscard({ cards, onDiscard }: WidowDiscardProps) {
  const [selected, setSelected] = useState<CardModel[]>([]);

  function toggle(card: CardModel) {
    setSelected((prev) => {
      if (prev.some((c) => cardsEqual(c, card))) return prev.filter((c) => !cardsEqual(c, card));
      if (prev.length >= 4) return prev;
      return [...prev, card];
    });
  }

  return (
    <div className={styles.panel}>
      <div className={styles.title}>You won the bid — choose 4 cards to discard ({selected.length}/4)</div>
      <div className={styles.grid}>
        {cards.map((card) => (
          <Card
            key={`${card.suit}-${card.rank}`}
            card={card}
            playable
            selected={selected.some((c) => cardsEqual(c, card))}
            onClick={() => toggle(card)}
          />
        ))}
      </div>
      <button className={styles.btn} disabled={selected.length !== 4} onClick={() => onDiscard(selected)}>
        Discard selected
      </button>
    </div>
  );
}
