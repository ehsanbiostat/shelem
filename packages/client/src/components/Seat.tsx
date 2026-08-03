import { fanAngles } from '@shelem/shared';
import styles from './Seat.module.css';
import { Card } from './Card.js';

export type SeatSlot = 'top' | 'bottom' | 'left' | 'right';

/** Opponent fans spread wider per card than the local hand (see fan.ts) — there's
 * a whole table edge to fill here (à la Trickster Cards) rather than a compact
 * hand of clickable cards, so a fuller, more dramatic arc reads better. Degrees
 * are unitless (not a `--u`-scaled length), so these stay plain constants. */
const FAN_DEGREES_PER_CARD = 10;
const FAN_MAX_SPREAD = 150;

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
  const count = Math.min(handSize, 12);
  const angles = fanAngles(count, FAN_DEGREES_PER_CARD, FAN_MAX_SPREAD);

  const row = (
    <div className={styles.fanRow}>
      {angles.map((angle, i) => (
        <div key={i} className={styles.fanCard} style={{ transform: `rotate(${angle}deg)` }}>
          {/* The crop lives in here, one level inside the rotated+positioned
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
