import { AnimatePresence, motion } from 'framer-motion';
import type { Card as CardModel, Suit } from '@shelem/shared';
import { fanAngles } from '@shelem/shared';
import styles from './Hand.module.css';
import { Card } from './Card.js';
import { cardKey } from '../cardKey.js';

export interface HandProps {
  cards: CardModel[];
  legalCards: CardModel[];
  isMyTurn: boolean;
  onPlay: (card: CardModel) => void;
  selectedCard: CardModel | null;
  trumpSuit?: Suit | null;
  /** Cards to call out with a highlight ring — e.g. the widow cards just added. */
  highlightedCards?: CardModel[];
  /** When set, the hand is in discard-picking mode: clicking a card toggles it in
   * this list instead of playing it, and a confirm bar appears once 4 are chosen.
   * Used for the declarer's widow discard, folded into the normal hand fan instead
   * of a separate picker panel. */
  discardSelection?: CardModel[];
  onToggleDiscard?: (card: CardModel) => void;
  onConfirmDiscard?: () => void;
}

const DISCARD_REQUIRED = 4;

/** Every card pivots around this same point, far below the fan — the standard
 * technique for an even circular arc: equal angle steps around a shared distant
 * origin land equal arc-length apart by construction, unlike overlapping cards a
 * fixed pixel amount and rotating each independently (which drifts uneven, since a
 * fixed offset doesn't account for how much a rotated card's edge shifts sideways).
 * Distance is measured from the card's own bottom edge. The angles themselves come
 * from `fanAngles` (shared package, unit-tested) — the same function used for
 * opponents' fans, so every seat's hand reads as the same shape. */
const PIVOT_DISTANCE_BELOW_CARD = 480;
/** Must match the 'lg' card height in Card.module.css — transform-origin's Y is an
 * offset from the card's own top edge, so this converts "below the bottom" to that. */
const CARD_LG_HEIGHT = 118;

function cardsEqual(a: CardModel, b: CardModel): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

/** The local player's own hand, fanned out and clickable. Cards not in `legalCards`
 * are shown but disabled — matches the rule that you can see why a card can't be
 * played (didn't follow suit / no trump) rather than hiding options silently. */
export function Hand({
  cards,
  legalCards,
  isMyTurn,
  onPlay,
  selectedCard,
  trumpSuit,
  highlightedCards,
  discardSelection,
  onToggleDiscard,
  onConfirmDiscard,
}: HandProps) {
  const total = cards.length;
  const isDiscardMode = discardSelection !== undefined;
  const angles = fanAngles(total);

  return (
    <div className={styles.wrap}>
      {isDiscardMode && (
        <div className={styles.discardBar}>
          <span>Choose {DISCARD_REQUIRED} cards to discard ({discardSelection!.length}/{DISCARD_REQUIRED})</span>
          <button
            type="button"
            className={styles.discardBtn}
            disabled={discardSelection!.length !== DISCARD_REQUIRED}
            onClick={onConfirmDiscard}
          >
            Discard
          </button>
        </div>
      )}

      <div className={styles.hand}>
        <AnimatePresence>
          {cards.map((card, i) => {
            const angle = angles[i];
            const playable = !isDiscardMode && isMyTurn && legalCards.some((c) => cardsEqual(c, card));
            const selected = isDiscardMode
              ? discardSelection!.some((c) => cardsEqual(c, card))
              : !!selectedCard && cardsEqual(selectedCard, card);
            const highlighted = !!highlightedCards?.some((c) => cardsEqual(c, card));
            return (
              <motion.div
                key={cardKey(card)}
                layoutId={cardKey(card)}
                className={styles.cardSlot}
                // Framer Motion rebuilds `transform-origin` from its own `originX`/`originY`
                // style keys every render and overwrites a plain `style.transformOrigin`
                // string with the CSS default (50% 50% 0) — so the far pivot has to be set
                // through those keys, not as a literal transform-origin value.
                style={{ originX: '50%', originY: `${CARD_LG_HEIGHT + PIVOT_DISTANCE_BELOW_CARD}px` }}
                initial={{ opacity: 0, y: 40, rotate: angle }}
                animate={{ opacity: 1, y: 0, rotate: angle }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                <Card
                  card={card}
                  size="lg"
                  playable={playable}
                  selected={selected}
                  highlighted={highlighted}
                  trump={!!trumpSuit && card.suit === trumpSuit}
                  disabled={isDiscardMode ? false : undefined}
                  onClick={() => (isDiscardMode ? onToggleDiscard!(card) : onPlay(card))}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
