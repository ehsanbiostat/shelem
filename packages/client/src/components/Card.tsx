import type { Card as CardModel, Suit } from '@shelem/shared';
import styles from './Card.module.css';
import { CardBackMotif } from './CardBackMotif.js';

const SUIT_GLYPH: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

const RED_SUITS = new Set<Suit>(['hearts', 'diamonds']);

export interface CardProps {
  card: CardModel;
  size?: 'sm' | 'md' | 'lg';
  faceDown?: boolean;
  selected?: boolean;
  playable?: boolean;
  onClick?: () => void;
}

function CardFace({ card, size }: { card: CardModel; size: 'sm' | 'md' | 'lg' }) {
  const colorClass = RED_SUITS.has(card.suit) ? styles.red : styles.black;
  const glyph = SUIT_GLYPH[card.suit];

  return (
    <div className={`${styles.card} ${styles[size]}`}>
      <div className={`${styles.face} ${colorClass}`}>
        <span className={styles.corner}>
          {card.rank}
          <span className={styles.suitGlyph}>{glyph}</span>
        </span>
        <span className={`${styles.corner} ${styles.bottom}`}>
          {card.rank}
          <span className={styles.suitGlyph}>{glyph}</span>
        </span>
      </div>
      <span className={`${styles.centerSuit} ${colorClass}`}>{glyph}</span>
    </div>
  );
}

function CardBack({ size }: { size: 'sm' | 'md' | 'lg' }) {
  return (
    <div className={`${styles.card} ${styles[size]}`}>
      <div className={styles.back}>
        <CardBackMotif />
      </div>
    </div>
  );
}

/** Renders a playing card. Purely presentational unless `onClick` is given, in which
 * case it renders as a button (used for the local player's playable hand). */
export function Card({ card, size = 'md', faceDown = false, selected = false, playable = false, onClick }: CardProps) {
  const content = faceDown ? <CardBack size={size} /> : <CardFace card={card} size={size} />;

  if (!onClick) return content;

  const classes = [styles.button, playable && styles.playable, selected && styles.selected, !playable && styles.disabled]
    .filter(Boolean)
    .join(' ');

  return (
    <button type="button" className={classes} onClick={onClick} disabled={!playable} aria-label={`${card.rank} of ${card.suit}`}>
      {content}
    </button>
  );
}
