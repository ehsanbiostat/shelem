import { useState } from 'react';
import styles from './ScoreBar.module.css';

export interface ScoreBarProps {
  team0Name: string;
  team1Name: string;
  team0Score: number;
  team1Score: number;
  team0HandPoints: number;
  team1HandPoints: number;
  matchTargetScore: number;
  handNumber: number;
}

/** Pinned to the table's bottom-left corner (see Table's `cornerPanel`). Starts
 * as a small tap target showing just the running score — full team names, hand
 * points, and target/hand number are a tap away instead of sitting open on the
 * felt all the time, since that's real space taken from a board that's already
 * tight on mobile. Tapping either state toggles to the other. */
export function ScoreBar({
  team0Name,
  team1Name,
  team0Score,
  team1Score,
  team0HandPoints,
  team1HandPoints,
  matchTargetScore,
  handNumber,
}: ScoreBarProps) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" className={styles.trigger} onClick={() => setOpen(true)} aria-label="Show scores">
        <span className={`${styles.dot} ${styles.dotA}`} />
        <span className={styles.triggerScore}>{team0Score}</span>
        <span className={styles.triggerSep}>–</span>
        <span className={styles.triggerScore}>{team1Score}</span>
        <span className={`${styles.dot} ${styles.dotB}`} />
      </button>
    );
  }

  return (
    <button type="button" className={styles.panel} onClick={() => setOpen(false)} aria-label="Hide scores">
      <div className={styles.team}>
        <span className={`${styles.dot} ${styles.dotA}`} />
        <span className={styles.name}>{team0Name}</span>
        <span className={styles.score}>{team0Score}</span>
      </div>
      <div className={styles.handPoints}>+{team0HandPoints} this hand</div>

      <div className={styles.team}>
        <span className={`${styles.dot} ${styles.dotB}`} />
        <span className={styles.name}>{team1Name}</span>
        <span className={styles.score}>{team1Score}</span>
      </div>
      <div className={styles.handPoints}>+{team1HandPoints} this hand</div>

      <div className={styles.meta}>
        <span>Target {matchTargetScore}</span>
        <span>Hand {handNumber}</span>
      </div>
    </button>
  );
}
