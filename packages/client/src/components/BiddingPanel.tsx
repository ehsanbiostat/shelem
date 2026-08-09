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

const AMOUNTS: number[] = [];
for (let amount = BID_FLOOR; amount <= BID_CAP; amount += BID_INCREMENT) AMOUNTS.push(amount);

/** Renders on the felt itself (as the Table's center content) rather than as a
 * panel below it — a direct-tap grid of every bid amount, matching the bidding
 * boxes used by Trickster Cards, instead of a dropdown-plus-submit-button.
 *
 * Controls and nothing else. This used to also carry a status line, the standing
 * highest bid, and a running list of who bid what — all of which the table already
 * says: each player's bid sits on their own label, and the gold ring says whose
 * turn it is. Repeating it in the middle just filled the one part of the board
 * that wants to stay empty. A player who isn't bidding now sees nothing here,
 * which is the point. */
export function BiddingPanel({ bidHistory, mySeat, currentTurnSeat, onBid }: BiddingPanelProps) {
  const highest = currentHighestBid(bidHistory);
  const isMyTurn = mySeat === currentTurnSeat;

  const shelemBid: Bid = { type: 'shelem' };
  const sarShelemBid: Bid = { type: 'sarShelem' };

  return (
    <div className={styles.panel}>


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

    </div>
  );
}
