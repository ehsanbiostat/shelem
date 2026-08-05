import { useState } from 'react';
import type { Card as CardModel, Seat as SeatIndex } from '@shelem/shared';
import styles from './LastTrickPanel.module.css';
import { Card } from './Card.js';
import { screenSlotFor } from '../screenSlot.js';

export interface LastTrickPlay {
  seat: SeatIndex;
  card: CardModel;
}

export interface LastTrickPanelProps {
  mySeat: SeatIndex;
  plays: LastTrickPlay[];
  winnerSeat: SeatIndex | -1;
  points: number;
  playerNames: Record<number, string>;
}

/** Lets a player look back at the trick that just finished. The live trick is only
 * held on screen for a beat before the next lead clears it (see ShelemRoom's
 * resolveTrick pause), which is easy to miss on a phone — this is that beat, on
 * demand.
 *
 * Entirely local: opening it sends nothing to the server and no one else can see
 * that it's open. Nothing here is hidden information either — all four players
 * watched these cards land — so it's a review, not a peek. */
export function LastTrickPanel({ mySeat, plays, winnerSeat, points, playerNames }: LastTrickPanelProps) {
  const [open, setOpen] = useState(false);

  if (plays.length === 0) return null;

  if (!open) {
    return (
      <button type="button" className={styles.trigger} onClick={() => setOpen(true)}>
        Last trick
      </button>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <span className={styles.title}>Last trick</span>
        <button type="button" className={styles.closeBtn} onClick={() => setOpen(false)} aria-label="Hide last trick">
          ×
        </button>
      </div>

      {/* Laid out in the seats' own screen positions rather than play order, so a
          card sits where its player sits — the same reading the live trick gives. */}
      <div className={styles.grid}>
        {plays.map(({ seat, card }) => {
          const slot = screenSlotFor(seat, mySeat);
          return (
            <div key={`${card.suit}-${card.rank}`} className={`${styles.cell} ${styles[slot]}`}>
              <Card card={card} size="sm" />
              <span className={`${styles.who} ${seat === winnerSeat ? styles.winner : ''}`}>
                {seat === mySeat ? 'You' : (playerNames[seat] ?? `Seat ${seat + 1}`)}
              </span>
            </div>
          );
        })}
      </div>

      {winnerSeat >= 0 && (
        <div className={styles.outcome}>
          Won by <strong>{winnerSeat === mySeat ? 'you' : playerNames[winnerSeat]}</strong> · {points} pts
        </div>
      )}
    </div>
  );
}
