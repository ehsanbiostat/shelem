import { useState } from 'react';
import type { Bid, Seat } from '@shelem/shared';
import { BID_CAP, BID_FLOOR, BID_INCREMENT, bidRank, isValidBid } from '@shelem/shared';
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

export function BiddingPanel({ bidHistory, mySeat, currentTurnSeat, playerNames, onBid }: BiddingPanelProps) {
  const highest = currentHighestBid(bidHistory);
  const isMyTurn = mySeat === currentTurnSeat;

  const numericOptions: number[] = [];
  for (let amount = BID_FLOOR; amount <= BID_CAP; amount += BID_INCREMENT) {
    if (!highest || amount > bidRank(highest)) numericOptions.push(amount);
  }
  const [selectedAmount, setSelectedAmount] = useState<number>(numericOptions[0] ?? BID_FLOOR);

  const shelemBid: Bid = { type: 'shelem' };
  const sarShelemBid: Bid = { type: 'sarShelem' };
  const numericBid: Bid = { type: 'numeric', amount: selectedAmount };

  return (
    <div className={styles.panel}>
      <div className={styles.status}>
        {highest ? (
          <>
            Highest bid: <span className={styles.highest}>{describeBid(highest)}</span>
          </>
        ) : (
          'No bids yet'
        )}
        {' — '}
        {isMyTurn ? "It's your turn to bid" : `Waiting on ${playerNames[currentTurnSeat]}`}
      </div>

      {isMyTurn && (
        <div className={styles.controls}>
          {numericOptions.length > 0 && (
            <>
              <select
                className={styles.select}
                value={selectedAmount}
                onChange={(e) => setSelectedAmount(Number(e.target.value))}
              >
                {numericOptions.map((amount) => (
                  <option key={amount} value={amount}>
                    {amount}
                  </option>
                ))}
              </select>
              <button className={`${styles.btn} ${styles.btnBid}`} onClick={() => onBid(numericBid)}>
                Bid {selectedAmount}
              </button>
            </>
          )}
          <button
            className={`${styles.btn} ${styles.btnShelem}`}
            disabled={!isValidBid(shelemBid, highest)}
            onClick={() => onBid(shelemBid)}
          >
            Shelem
          </button>
          <button
            className={`${styles.btn} ${styles.btnSarShelem}`}
            disabled={!isValidBid(sarShelemBid, highest)}
            onClick={() => onBid(sarShelemBid)}
          >
            Sar-Shelem
          </button>
          <button className={`${styles.btn} ${styles.btnPass}`} onClick={() => onBid({ type: 'pass' })}>
            Pass
          </button>
        </div>
      )}

      {bidHistory.length > 0 && (
        <div className={styles.history}>
          {bidHistory.map((item, i) => (
            <span key={i} className={styles.historyItem}>
              {playerNames[item.seat]}: {describeBid(item.bidType === 'numeric' ? { type: 'numeric', amount: item.amount } : { type: item.bidType })}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
