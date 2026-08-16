import type { Suit } from '@shelem/shared';
import { SUITS } from '@shelem/shared';
import styles from './TrumpPicker.module.css';

const SUIT_SYMBOL: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

const SUIT_NAME: Record<Suit, string> = {
  spades: 'Spades',
  hearts: 'Hearts',
  diamonds: 'Diamonds',
  clubs: 'Clubs',
};

export interface TrumpPickerProps {
  /** True when this client is the Hâkem and the choice is theirs to make. */
  isHakem: boolean;
  hakemName: string;
  onDeclare: (suit: Suit) => void;
}

/**
 * The Hâkem's one decision, and the moment the game turns on: trump is named
 * knowing five cards, with the other eight still undealt.
 *
 * The other three seats see who is choosing rather than an empty table. They are
 * holding five cards of their own at this point and can do nothing with them,
 * which is worth saying plainly instead of leaving the board looking stuck.
 */
export function TrumpPicker({ isHakem, hakemName, onDeclare }: TrumpPickerProps) {
  if (!isHakem) {
    return (
      <div className={styles.waiting}>
        <div className={styles.big}>{hakemName} is choosing trump</div>
        <div className={styles.hint}>They can see five cards, the same as you.</div>
      </div>
    );
  }

  return (
    <div className={styles.picker}>
      <div className={styles.big}>You are the Hâkem — name trump</div>
      <div className={styles.hint}>Choose on these five cards. The other eight follow.</div>
      <div className={styles.suits}>
        {SUITS.map((suit) => (
          <button
            key={suit}
            type="button"
            className={`${styles.suit} ${styles[suit]}`}
            onClick={() => onDeclare(suit)}
            aria-label={SUIT_NAME[suit]}
          >
            <span className={styles.glyph} aria-hidden="true">
              {SUIT_SYMBOL[suit]}
            </span>
            <span className={styles.suitName}>{SUIT_NAME[suit]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
