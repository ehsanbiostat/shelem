import { memo } from 'react';
import { fanAngles } from '@shelem/shared';
import type { Suit } from '@shelem/shared';
import styles from './Seat.module.css';
import { Card } from './Card.js';
import { useTableMetrics } from '../tableMetrics.js';
import { fitSpacing, fanOffsets, fanCurve } from '../fanGeometry.js';

export type SeatSlot = 'top' | 'bottom' | 'left' | 'right';

/** The trump suit is set by the declarer's opening lead, not announced — so once
 * it exists it's shown against the declarer's own name, where the table already
 * looks to see who took the contract. */
const SUIT_SYMBOL: Record<Suit, string> = { spades: '\u2660', hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663' };

/** Purely cosmetic tilt (see fanGeometry.ts — position comes from spacing, not
 * from these angles), so it needs to stay modest regardless of how tightly
 * `fitSpacing` ends up packing the cards: a card doesn't get more room to
 * rotate into just because more cards fit into the same space, so a wide
 * angle range (this used to go up to ±55°, back when rotation also drove
 * position and wider angles meant more spread) reads as a jumbled, crossed-
 * over mess of edges once density and angle are independent — exactly the
 * "cut into each other" / "strange orientation" look. */
const FAN_DEGREES_PER_CARD = 0;
const FAN_MAX_SPREAD = 0;
/** Fraction of a card's own width used as the (desired, capped-to-fit) gap
 * between adjacent card centers — smaller than 1 so cards overlap. */
const FAN_SPACING_RATIO = 0.4;
/** How far (in `--u`) dead-center pokes further into the table than the two
 * outermost cards — see fanCurve in fanGeometry.ts. */
const FAN_CURVE_U = 0;

/** The top seat's fan uses full-size 'md' cards; the side seats' use the smaller
 * 'sm', because their footprint eats table *width* — the scarce axis on a phone.
 * See the .left/.right block in Seat.module.css for the full reasoning, and keep
 * both the size choice and these multipliers in step with it and with
 * Card.module.css's own width multipliers. */
const FAN_CARD_SIZE = { top: 'md', left: 'md', right: 'md' } as const;
const CARD_WIDTH_U = { md: 9.7, sm: 6.3 } as const;

export interface SeatProps {
  name: string;
  connected: boolean;
  handSize: number;
  /** The most cards this seat's fan will ever draw. Shelem hands hold 12, Hokm's 13
   * — the fan is capped so it can't overflow the table edge if a hand grows past it. */
  maxFanCards: number;
  isTurn: boolean;
  /** This seat is being waited on for a decision that isn't a card — a Shelem bid,
   * a Hokm trump call. Shows a "thinking" badge in place of any other. */
  isChoosing: boolean;
  /** This seat holds the hand's special role: Shelem's declarer, Hokm's Hâkem.
   * It's where the trump glyph goes. */
  hasRole: boolean;
  /** Short badge beside the name — the bid this seat made, in Shelem. */
  badgeLabel?: string;
  /** Draws `badgeLabel` in the quieter style, for a badge that isn't news (a Pass). */
  badgeMuted?: boolean;
  /**
   * This team's running figure for the hand, already worded by the game — card
   * points in Shelem, tricks in Hokm.
   *
   * It is the *team's*, so both members of a team carry the same one and the table
   * shows two values across four seats. The colour is what makes that legible
   * rather than misleading: without it, four labels reading 95 · 40 · 95 · 40 read
   * as four players' scores totalling 270. Team colours match the score panel's
   * own dots, so it needs no legend of its own.
   */
  handScore?: { value: string; team: 0 | 1 };
  /** Shown against the seat holding the role, once trump is known. */
  trumpSuit?: Suit | null;
  empty: boolean;
  slot: SeatSlot;
  /** Hides this seat's cards (not its name) while the deal animation plays. */
  hideFan?: boolean;
}

/** Opponents are represented by a fanned arc of face-down cards hugging the table
 * edge (à la Trickster Cards) instead of an avatar — the fan itself communicates
 * "this is a hand of cards" without needing a portrait, and its evenness lets you
 * tell how many cards someone's holding at a glance. The fan is always built as
 * the same horizontal row; for the side seats that whole row is then rotated as
 * one rigid block so its top edge points the same way that seat's (also rotated)
 * name reads — never a mismatched mix. */
function CardFan({
  handSize,
  maxFanCards,
  orientation,
}: {
  handSize: number;
  maxFanCards: number;
  orientation: 'top' | 'left' | 'right';
}) {
  const { width, height, u } = useTableMetrics();
  const count = Math.min(handSize, maxFanCards);
  // Negated because an opponent's fan is our own fan seen from the other side of
  // the table — i.e. rotated 180°. That rotation flips both halves of the arc:
  // the bulge (handled by negating `curve` below) *and* the direction each card
  // tilts. Only the curve used to be flipped, which left every opponent's cards
  // tilting the way a near-side hand tilts while the arc they sat on bulged the
  // opposite way — tilt and arc disagreeing is what read as a reversed arc.
  const angles = fanAngles(count, FAN_DEGREES_PER_CARD, FAN_MAX_SPREAD).map((a) => -a);

  // The fan spreads along the table's width for the top seat, and along its
  // height for a side seat (before that whole row gets rotated 90° — see
  // .fanWrap below). Spacing is capped to guarantee the whole fan fits in
  // *this* much real, measured space, for *this* many cards (see
  // fanGeometry.ts for why this — not deriving position from rotation — is
  // what actually guarantees every card fits).
  const cardSize = FAN_CARD_SIZE[orientation];
  const cardWidthPx = CARD_WIDTH_U[cardSize] * u;
  const availableSpace = orientation === 'top' ? width : height;
  const spacing = fitSpacing(availableSpace, cardWidthPx, count, cardWidthPx * FAN_SPACING_RATIO);
  const offsets = fanOffsets(count, spacing);
  // fanCurve's "negative = further into the table" convention matches Hand.tsx
  // directly (its row sits at the *bottom* of the screen, so "extends toward
  // smaller local Y" — up and away from its own bottom anchor — means "toward
  // the table"). Every opponent seat's row sits at the *opposite* screen edge
  // from Hand's, so the exact same "extends toward smaller local Y" instead
  // means "toward the true edge, away from the table" — negated here so dead
  // center still ends up further into the table, not further toward the edge.
  const curve = fanCurve(offsets, FAN_CURVE_U * u).map((v) => -v);

  const row = (
    <div className={styles.fanRow}>
      {angles.map((angle, i) => (
        <div
          key={i}
          className={styles.fanCard}
          style={{
            transform: `translate(${offsets[i]}px, ${curve[i]}px) rotate(${angle}deg)`,
            // Without this, stacking order falls back to DOM order (left-to-
            // right) regardless of the curve — so a card the curve pushes
            // toward the viewer could still render *behind* a neighbor it's
            // supposed to be in front of, which is exactly what read as cards
            // "cutting into" each other. Matching z-index to the same
            // distance-from-center the curve itself uses keeps the two
            // consistent: dead center is both furthest forward and topmost.
            zIndex: Math.round(1000 - Math.abs(offsets[i])),
          }}
        >
          <Card card={{ suit: 'spades', rank: '2' }} size={cardSize} faceDown />
        </div>
      ))}
    </div>
  );

  if (orientation === 'top') return row;
  return <div className={`${styles.fanWrap} ${styles[orientation]}`}>{row}</div>;
}

function SeatImpl({
  name,
  connected,
  handSize,
  maxFanCards,
  isTurn,
  isChoosing,
  hasRole,
  badgeLabel,
  badgeMuted = false,
  handScore,
  trumpSuit,
  empty,
  slot,
  hideFan = false,
}: SeatProps) {
  const identity = (
    <div className={styles.identity}>
      {/* The score sits inside the name row rather than on a line of its own.
          `.identity` grows toward the middle of the table (see its comment), so a
          new row would eat playing area; another item on this row grows along the
          table edge instead, where there is room. */}
      <div className={styles.name}>
        <span className={`${styles.connectedDot} ${connected ? '' : styles.offline}`} />
        {empty ? 'Waiting…' : name}
        {!empty && handScore && (
          <span className={`${styles.scoreBadge} ${handScore.team === 0 ? styles.scoreTeam0 : styles.scoreTeam1}`}>
            {handScore.value}
          </span>
        )}
      </div>
      {isChoosing && <span className={styles.biddingBadge}>Thinking…</span>}
      {!isChoosing && badgeLabel && (
        <span className={`${styles.bidLabelBadge} ${badgeMuted ? styles.bidLabelPass : ''}`}>{badgeLabel}</span>
      )}
      {hasRole && trumpSuit && (
        <span className={`${styles.trumpBadge} ${styles[trumpSuit]}`} title={`Trump: ${trumpSuit}`}>
          {SUIT_SYMBOL[trumpSuit]}
        </span>
      )}
    </div>
  );

  const fan =
    !empty && handSize > 0 && slot !== 'bottom' ? (
      <CardFan handSize={handSize} maxFanCards={maxFanCards} orientation={slot} />
    ) : null;

  return (
    <div className={`${styles.seat} ${styles[slot]} ${isTurn ? styles.activeTurn : ''} ${hideFan ? styles.fanHidden : ''}`}>
      {slot === 'top' && fan}
      {slot === 'left' && fan}
      {identity}
      {slot === 'right' && fan}
    </div>
  );
}

/* Memoised because the table re-renders on every step of the deal animation as
 * each block lands, and a seat's own props don't change when that happens. Without
 * this, five landings meant five full reconciliations of four seats' twelve-card
 * fans in the middle of the animation — measured as ~90-175ms frames, i.e. visible
 * stutter, on a 4x-throttled CPU. */
export const Seat = memo(SeatImpl);
