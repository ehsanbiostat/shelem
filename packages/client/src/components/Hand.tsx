import { AnimatePresence, motion } from 'framer-motion';
import type { Card as CardModel, Suit } from '@shelem/shared';
import { fanAngles } from '@shelem/shared';
import styles from './Hand.module.css';
import { Card } from './Card.js';
import { cardKey } from '../cardKey.js';
import { useTableMetrics } from '../tableMetrics.js';
import { fitSpacing, fanOffsets, fanCurve } from '../fanGeometry.js';

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

/** Each card gets its own horizontal offset (spacing capped to guarantee the
 * whole hand fits within the table's actual measured width, for however many
 * cards are actually in it — up to 16, during the declarer's widow discard —
 * see fanGeometry.ts) plus a small cosmetic tilt from the shared `fanAngles`
 * (same function used for opponents' fans, so every seat's hand reads as the
 * same shape). An earlier version derived position from rotating each card
 * around a distant pivot instead, which has an unavoidable side effect
 * (fanGeometry.ts has the full explanation) — position and rotation are
 * decoupled here specifically to avoid that. */
/** Must match the 'xl' card width multiplier in Card.module.css. */
const CARD_XL_WIDTH_U = 17;
/** Fraction of a card's own width used as the (desired, capped-to-fit) gap
 * between adjacent card centers. */
const FAN_SPACING_RATIO = 0.45;
/** How far (in `--u`) dead-center pokes further into the table (up, toward the
 * felt) than the two outermost cards — see fanCurve in fanGeometry.ts. */
const FAN_CURVE_U = 4;
/** How far (in `--u`) a playable or selected card rises out of the fan. Applied
 * here rather than by Card's own `.button.playable` transform, because these
 * cards are cropped (see `.crop` in Hand.module.css) and a transform *inside* a
 * crop window scrolls the art instead of lifting the card. */
const LIFT_PLAYABLE_U = 1.6;
const LIFT_SELECTED_U = 3.6;

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
  const { width, u } = useTableMetrics();
  const cardWidthPx = CARD_XL_WIDTH_U * u;
  const spacing = fitSpacing(width, cardWidthPx, total, cardWidthPx * FAN_SPACING_RATIO);
  const offsets = fanOffsets(total, spacing);
  const curve = fanCurve(offsets, FAN_CURVE_U * u);

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
            const lift = selected ? LIFT_SELECTED_U * u : playable ? LIFT_PLAYABLE_U * u : 0;
            return (
              <motion.div
                key={cardKey(card)}
                layoutId={cardKey(card)}
                className={styles.cardSlot}
                initial={{ opacity: 0, x: offsets[i], y: 40 + curve[i], rotate: angle }}
                animate={{ opacity: 1, x: offsets[i], y: curve[i] - lift, rotate: angle }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                <div className={styles.crop}>
                  <Card
                    card={card}
                    size="xl"
                    playable={playable}
                    selected={selected}
                    highlighted={highlighted}
                    trump={!!trumpSuit && card.suit === trumpSuit}
                    disabled={isDiscardMode ? false : undefined}
                    liftOnInteract={false}
                    onClick={() => (isDiscardMode ? onToggleDiscard!(card) : onPlay(card))}
                  />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
