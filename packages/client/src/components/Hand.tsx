import { useEffect, useState } from 'react';
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
  /** The four cards the widow pickup just added. They rise clear of the hand for a
   * couple of seconds so the declarer can see what they got — the fan is sorted by
   * suit, so the new cards scatter through it rather than arriving as a group, and
   * there is otherwise no way to tell which four they were. The hand is inert while
   * they are up, so a tap can't turn "new" into "selected" mid-showcase. */
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
const CARD_XL_WIDTH_U = 21;
/** Fraction of a card's own width used as the (desired, capped-to-fit) gap
 * between adjacent card centers. */
const FAN_SPACING_RATIO = 0.45;
/** Tilt spread, wider than `fanAngles`' defaults. Rotation is purely cosmetic
 * (see fanGeometry.ts — position comes from spacing), but it's half of what makes
 * a hand read as a *fan* rather than a curved row, and it costs no vertical room
 * the way a deeper curve does. */
const FAN_DEGREES_PER_CARD = 0;
const FAN_MAX_SPREAD = 0;
/** How far (in `--u`) dead-center pokes further into the table (up, toward the
 * felt) than the two outermost cards — see fanCurve in fanGeometry.ts.
 *
 * This is what carries the drop, not the anchor. The anchor sets where the arc's
 * *ends* sit (-18u — well below the screen edge), and this lifts the middle back
 * up so the hand stays readable: without it, pushing the ends down would drag the
 * whole hand off the bottom with them. Cards are only ever clipped from below, so
 * a clipped card keeps its top-left rank index — the part you actually read in a
 * fan — which is why the ends can afford to go this far. */
const FAN_CURVE_U = 0;
/** How far (in `--u`) a playable or selected card rises out of the fan. Applied
 * here rather than by Card's own `.button.playable` transform, so it scales with
 * the board like every other distance on the table instead of being a fixed 6px
 * that reads as nothing on a phone and as a twitch on a desktop. */
const LIFT_PLAYABLE_U = 1.6;
const LIFT_SELECTED_U = 3.6;
/** How far the four widow cards ride above the rest when the declarer picks them
 * up. Deliberately well clear of LIFT_SELECTED_U — selection is also a lift, so if
 * the two were close the new cards would read as already-chosen ones. */
const LIFT_WIDOW_U = 9;
/** How long they stay up. Long enough to find four cards scattered across a
 * sorted fan, short enough not to be waited on. */
const WIDOW_SHOWCASE_MS = 2500;

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
  // Keyed on the actual cards, so the showcase runs once per widow pickup rather
  // than on every re-render while the declarer is deciding.
  const widowKey = (highlightedCards ?? []).map(cardKey).join(',');
  const [showcasing, setShowcasing] = useState(false);
  useEffect(() => {
    if (!widowKey) {
      setShowcasing(false);
      return;
    }
    setShowcasing(true);
    const timer = window.setTimeout(() => setShowcasing(false), WIDOW_SHOWCASE_MS);
    return () => clearTimeout(timer);
  }, [widowKey]);

  const total = cards.length;
  const isDiscardMode = discardSelection !== undefined;
  const angles = fanAngles(total, FAN_DEGREES_PER_CARD, FAN_MAX_SPREAD);
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

      {/* Taps are blocked while the widow cards are up, via pointer-events rather
          than the buttons' disabled state: disabled cards are greyed out, and
          greying the whole hand for two seconds to protect four raised cards is a
          worse cure than the problem. */}
      <div className={`${styles.hand} ${showcasing ? styles.inert : ''}`}>
        <AnimatePresence>
          {cards.map((card, i) => {
            const angle = angles[i];
            const playable = !isDiscardMode && isMyTurn && legalCards.some((c) => cardsEqual(c, card));
            const selected = isDiscardMode
              ? discardSelection!.some((c) => cardsEqual(c, card))
              : !!selectedCard && cardsEqual(selectedCard, card);
            const isWidowCard = !!highlightedCards?.some((c) => cardsEqual(c, card));
            const rising = showcasing && isWidowCard;
            const lift = rising
              ? LIFT_WIDOW_U * u
              : selected
                ? LIFT_SELECTED_U * u
                : playable
                  ? LIFT_PLAYABLE_U * u
                  : 0;
            return (
              <motion.div
                key={cardKey(card)}
                className={styles.cardSlot}
                initial={{ opacity: 0, x: offsets[i], y: 40 + curve[i], rotate: angle }}
                animate={{ opacity: 1, x: offsets[i], y: curve[i] - lift, rotate: angle }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 34, mass: 0.7 }}
              >
                <div className={styles.hoverLift}>
                  <Card
                  card={card}
                  size="xl"
                  playable={playable}
                  selected={selected}
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
