import { fanAngles } from '@shelem/shared';
import styles from './Seat.module.css';
import { Card } from './Card.js';
import { useTableMetrics } from '../tableMetrics.js';
import { fitSpacing, fanOffsets } from '../fanGeometry.js';

export type SeatSlot = 'top' | 'bottom' | 'left' | 'right';

/** Opponent fans spread wider per card than the local hand (see fan.ts) — there's
 * a whole table edge to fill here (à la Trickster Cards) rather than a compact
 * hand of clickable cards, so a fuller, more dramatic tilt per card reads
 * better. Purely cosmetic now (see fanGeometry.ts) — position comes from
 * spacing, not from these angles. */
const FAN_DEGREES_PER_CARD = 10;
const FAN_MAX_SPREAD = 150;
/** Fraction of a card's own width used as the (desired, capped-to-fit) gap
 * between adjacent card centers — smaller than 1 so cards overlap. */
const FAN_SPACING_RATIO = 0.4;

/** Must match the 'md' card width multiplier in Card.module.css. */
const CARD_MD_WIDTH_U = 9.7;

export interface SeatProps {
  name: string;
  connected: boolean;
  handSize: number;
  isDealer: boolean;
  isTurn: boolean;
  isBiddingTurn: boolean;
  isDeclarer: boolean;
  bidLabel?: string;
  empty: boolean;
  slot: SeatSlot;
}

/** Opponents are represented by a fanned arc of face-down cards hugging the table
 * edge (à la Trickster Cards) instead of an avatar — the fan itself communicates
 * "this is a hand of cards" without needing a portrait, and its evenness lets you
 * tell how many cards someone's holding at a glance. The fan is always built as
 * the same horizontal row; for the side seats that whole row is then rotated as
 * one rigid block so its top edge points the same way that seat's (also rotated)
 * name reads — never a mismatched mix. */
function CardFan({ handSize, orientation }: { handSize: number; orientation: 'top' | 'left' | 'right' }) {
  const { width, height, u } = useTableMetrics();
  const count = Math.min(handSize, 12);
  const angles = fanAngles(count, FAN_DEGREES_PER_CARD, FAN_MAX_SPREAD);

  // The fan spreads along the table's width for the top seat, and along its
  // height for a side seat (before that whole row gets rotated 90° — see
  // .fanWrap below). Spacing is capped to guarantee the whole fan fits in
  // *this* much real, measured space, for *this* many cards (see
  // fanGeometry.ts for why this — not deriving position from rotation — is
  // what actually guarantees every card fits).
  const cardWidthPx = CARD_MD_WIDTH_U * u;
  const availableSpace = orientation === 'top' ? width : height;
  const spacing = fitSpacing(availableSpace, cardWidthPx, count, cardWidthPx * FAN_SPACING_RATIO);
  const offsets = fanOffsets(count, spacing);

  const row = (
    <div className={styles.fanRow}>
      {angles.map((angle, i) => (
        <div key={i} className={styles.fanCard} style={{ transform: `translateX(${offsets[i]}px) rotate(${angle}deg)` }}>
          {/* The crop lives in here, one level inside the positioned+tilted
           * .fanCard, not on the shared row — see the comment on .fanCardCrop
           * in Seat.module.css for why cropping the row itself doesn't work. */}
          <div className={styles.fanCardCrop}>
            <Card card={{ suit: 'spades', rank: '2' }} size="md" faceDown />
          </div>
        </div>
      ))}
    </div>
  );

  if (orientation === 'top') return row;
  return <div className={`${styles.fanWrap} ${styles[orientation]}`}>{row}</div>;
}

export function Seat({
  name,
  connected,
  handSize,
  isDealer,
  isTurn,
  isBiddingTurn,
  isDeclarer,
  bidLabel,
  empty,
  slot,
}: SeatProps) {
  const identity = (
    <div className={styles.identity}>
      <div className={styles.name}>
        <span className={`${styles.connectedDot} ${connected ? '' : styles.offline}`} />
        {empty ? 'Waiting…' : name}
      </div>
      {isDealer && !empty && <span className={styles.dealerTag}>Dealer</span>}
      {isBiddingTurn && <span className={styles.biddingBadge}>Bidding…</span>}
      {!isBiddingTurn && bidLabel && (
        <span className={`${styles.bidLabelBadge} ${bidLabel === 'Pass' ? styles.bidLabelPass : ''}`}>{bidLabel}</span>
      )}
      {isDeclarer && <span className={styles.declarerBadge}>Declarer</span>}
    </div>
  );

  const fan =
    !empty && handSize > 0 && slot !== 'bottom' ? <CardFan handSize={handSize} orientation={slot} /> : null;

  return (
    <div className={`${styles.seat} ${styles[slot]} ${isTurn ? styles.activeTurn : ''}`}>
      {slot === 'top' && fan}
      {slot === 'left' && fan}
      {identity}
      {slot === 'right' && fan}
    </div>
  );
}
