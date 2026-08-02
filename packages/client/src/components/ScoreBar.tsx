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

/** A small translucent square pinned to the table's bottom-left corner (see
 * Table's `cornerPanel`) rather than a full-width bar above the felt — keeps the
 * score visible without competing with the felt or the hand for space. */
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
  return (
    <div className={styles.panel}>
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
    </div>
  );
}
