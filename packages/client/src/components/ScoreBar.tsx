import styles from './ScoreBar.module.css';

export interface ScoreBarProps {
  team0Score: number;
  team1Score: number;
  matchTargetScore: number;
  handNumber: number;
}

export function ScoreBar({ team0Score, team1Score, matchTargetScore, handNumber }: ScoreBarProps) {
  return (
    <div className={styles.bar}>
      <div className={styles.team}>
        <span className={`${styles.dot} ${styles.dotA}`} />
        Team A <span className={styles.score}>{team0Score}</span>
      </div>
      <div className={styles.team}>
        <span className={`${styles.dot} ${styles.dotB}`} />
        Team B <span className={styles.score}>{team1Score}</span>
      </div>
      <span className={styles.target}>Target: {matchTargetScore}</span>
      <span className={styles.hand}>Hand {handNumber}</span>
    </div>
  );
}
