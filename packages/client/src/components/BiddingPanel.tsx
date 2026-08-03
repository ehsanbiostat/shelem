import type { Bid, Seat } from '@shelem/shared';
import { BID_CAP, BID_FLOOR, BID_INCREMENT, isValidBid } from '@shelem/shared';
import styles from './BiddingPanel.module.css';

export interface BidHistoryItem {
  seat: Seat;
  bidType: 'numeric' | 'shelem' | 'sarShelem' | 'pass';
  amount: number;
}

export interface BiddingPanelProps {
  bidHistory: BidHistoryItem[];
  mySeat: Seat;
  currentTurnSeat: Seat;
  playerNames: Record<Seat, string>;
  onBid: (bid: Bid) => void;
}

function currentHighestBid(history: BidHistoryItem[]): Bid | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const item = history[i];
    if (item.bidType === 'pass') continue;
    if (item.bidType === 'numeric') return { type: 'numeric', amount: item.amount };
    return { type: item.bidType };
  }
  return null;
}

function describeBid(bid: Bid): string {
  if (bid.type === 'numeric') return String(bid.amount);
  if (bid.type === 'shelem') return 'Shelem';
  if (bid.type === 'sarShelem') return 'Sar-Shelem';
  return 'Pass';
}

const AMOUNTS: number[] = [];
for (let amount = BID_FLOOR; amount <= BID_CAP; amount += BID_INCREMENT) AMOUNTS.push(amount);

/** Renders on the felt itself (as the Table's center content) rather than as a
 * panel below it — a direct-tap grid of every bid amount, matching the bidding
 * boxes used by Trickster Cards, instead of a dropdown-plus-submit-button. */
export function BiddingPanel({ bidHistory, mySeat, currentTurnSeat, playerNames, onBid }: BiddingPanelProps) {
  const highest = currentHighestBid(bidHistory);
  const isMyTurn = mySeat === currentTurnSeat;

  const shelemBid: Bid = { type: 'shelem' };
  const sarShelemBid: Bid = { type: 'sarShelem' };

  return (
    <div className={styles.panel}>
      <div className={styles.status}>{isMyTurn ? 'Your turn to bid' : `Waiting on ${playerNames[currentTurnSeat]}`}</div>

      {highest && (
        <div className={styles.statusSub}>
          Highest bid: <span className={styles.highest}>{describeBid(highest)}</span>
        </div>
      )}

      {isMyTurn && (
        <>
          <div className={styles.grid}>
            {AMOUNTS.map((amount) => (
              <button
                key={amount}
                type="button"
                className={styles.amountBtn}
                disabled={!isValidBid({ type: 'numeric', amount }, highest)}
                onClick={() => onBid({ type: 'numeric', amount })}
              >
                {amount}
              </button>
            ))}
          </div>

          <div className={styles.specials}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnShelem}`}
              disabled={!isValidBid(shelemBid, highest)}
              onClick={() => onBid(shelemBid)}
            >
              Shelem
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSarShelem}`}
              disabled={!isValidBid(sarShelemBid, highest)}
              onClick={() => onBid(sarShelemBid)}
            >
              Sar-Shelem
            </button>
            <button type="button" className={`${styles.btn} ${styles.btnPass}`} onClick={() => onBid({ type: 'pass' })}>
              Pass
            </button>
          </div>
        </>
      )}

      {bidHistory.length > 0 && (
        <div className={styles.history}>
          {bidHistory.map((item, i) => (
            <span key={i} className={styles.historyItem}>
              {playerNames[item.seat]}:{' '}
              {describeBid(item.bidType === 'numeric' ? { type: 'numeric', amount: item.amount } : { type: item.bidType })}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
