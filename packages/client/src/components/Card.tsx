import * as standardDeck from '@letele/playing-cards';
import type { Card as CardModel, Suit } from '@shelem/shared';
import styles from './Card.module.css';
import { CardBackMotif } from './CardBackMotif.js';

const SUIT_LETTER: Record<Suit, string> = {
  spades: 'S',
  hearts: 'H',
  diamonds: 'D',
  clubs: 'C',
};

/** The deck's export names pair a suit letter with the rank, lowercased for the
 * three letter ranks and the ace (`Sk`, `Hq`, `Ca`...) but left as the plain digit
 * string for number cards (`S10`, `H9`...). */
const RANK_LETTER: Partial<Record<CardModel['rank'], string>> = { A: 'a', J: 'j', Q: 'q', K: 'k' };

/** Every size is a multiple of the shared `--u` scale unit — see Card.module.css
 * for the multipliers, and note that callers computing fan geometry mirror those
 * width multipliers in TS (Hand.tsx, Seat.tsx) and must be kept in step. */
export type CardSize = 'sm' | 'md' | 'lg' | 'xl';

function standardDeckKey(card: CardModel): string {
  return `${SUIT_LETTER[card.suit]}${RANK_LETTER[card.rank] ?? card.rank}`;
}

/** Full-face SVGs from Adrian Kennard's public-domain print-ready deck (via
 * @letele/playing-cards) — the standard rank/suit layout, corner indices, and
 * face-card portraits players expect, instead of a hand-rolled approximation. */
function CardFace({
  card,
  size,
  trump,
}: {
  card: CardModel;
  size: CardSize;
  trump?: boolean;
}) {
  const Face = standardDeck[standardDeckKey(card)];

  return (
    <div className={`${styles.card} ${styles[size]}`}>
      <div className={`${styles.face} ${trump ? styles.trump : ''} `}>
        <Face className={styles.faceArt} />
      </div>
    </div>
  );
}

function CardBack({ size }: { size: CardSize }) {
  return (
    <div className={`${styles.card} ${styles[size]}`}>
      <div className={styles.back}>
        <CardBackMotif />
      </div>
    </div>
  );
}

export interface CardProps {
  card: CardModel;
  size?: CardSize;
  faceDown?: boolean;
  selected?: boolean;
  playable?: boolean;
  /** Card's suit is the current trump — draws a subtle ring so it stands out in hand. */
  trump?: boolean;
  /** Overrides the default (`!playable`) disabled state — for modes like widow
   * discard where every card is clickable but none should show the "legal" ring. */
  disabled?: boolean;
  /** Set false when the card is rendered inside a crop window, where a lift
   * transform would scroll the art out of view rather than raise the card — the
   * caller then owns the lift. See `.button.noLift` in Card.module.css. */
  liftOnInteract?: boolean;
  onClick?: () => void;
}

/** Renders a playing card. Purely presentational unless `onClick` is given, in which
 * case it renders as a button (used for the local player's playable hand). */
export function Card({
  card,
  size = 'md',
  faceDown = false,
  selected = false,
  playable = false,
  trump = false,
  disabled,
  liftOnInteract = true,
  onClick,
}: CardProps) {
  const content = faceDown ? <CardBack size={size} /> : <CardFace card={card} size={size} trump={trump} />;

  if (!onClick) return content;

  const isDisabled = disabled ?? !playable;
  const classes = [
    styles.button,
    playable && styles.playable,
    selected && styles.selected,
    isDisabled && styles.disabled,
    !liftOnInteract && styles.noLift,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type="button" className={classes} onClick={onClick} disabled={isDisabled} aria-label={`${card.rank} of ${card.suit}`}>
      {content}
    </button>
  );
}
