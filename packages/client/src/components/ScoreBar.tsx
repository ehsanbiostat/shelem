import { useState } from 'react';
import styles from './ScoreBar.module.css';
import { Overlay } from './Overlay.js';
import type { HandResultJSON } from '../roomState.js';

export interface ScoreBarProps {
  team0Name: string;
  team1Name: string;
  team0Score: number;
  team1Score: number;
  team0HandPoints: number;
  team1HandPoints: number;
  matchTargetScore: number;
  handNumber: number;
  /** Every hand scored so far, oldest first. Shown newest-first below. */
  handHistory: HandResultJSON[];
  /** Held open by the game rather than the player — the end-of-hand pause and the
   * end of a match. Not dismissible while set. */
  heldOpen?: boolean;
  /** Present only at the end of a match. */
  rematch?: { ready: number; total: number; iAmReady: boolean; onPlayAgain: () => void };
}

function signed(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta);
}

/** Pinned to the table's top-left corner (see Table's `cornerPanel`). Starts
 * as a small tap target showing just the running score — full team names, hand
 * points, target/hand number, and the per-hand history are a tap away instead of
 * sitting open on the felt all the time, since that's real space taken from a
 * board that's already tight on mobile. */
export function ScoreBar({
  team0Name,
  team1Name,
  team0Score,
  team1Score,
  team0HandPoints,
  team1HandPoints,
  matchTargetScore,
  handNumber,
  handHistory,
  heldOpen = false,
  rematch,
}: ScoreBarProps) {
  const [open, setOpen] = useState(false);

  if (!open && !heldOpen) {
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
    <Overlay
      title={rematch ? 'Match complete' : heldOpen ? 'Hand complete' : 'Score'}
      onClose={() => setOpen(false)}
      dismissible={!heldOpen}
    >
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

      {handHistory.length > 0 && (
        <div className={styles.history}>
          {/* Deliberately just the two numbers per hand. Declarer, bid, made/set and
              running totals all lived here and made a five-column table out of a
              thing people glance at; the totals above already say where the match
              stands, so the history only has to say how it got there. */}
          <div className={styles.historyHead}>
            <span />
            <span className={styles.num}>
              <span className={`${styles.dot} ${styles.dotA}`} />
            </span>
            <span className={styles.num}>
              <span className={`${styles.dot} ${styles.dotB}`} />
            </span>
          </div>
          {/* Newest first — the hand that just finished is the one being looked for. */}
          {[...handHistory].reverse().map((result) => (
            <div key={result.handNumber} className={styles.historyRow}>
              <span className={styles.historyHand}>{result.handNumber}</span>
              <span className={styles.num}>{signed(result.team0Delta)}</span>
              <span className={styles.num}>{signed(result.team1Delta)}</span>
            </div>
          ))}
        </div>
      )}

      {rematch && (
        <div className={styles.rematch}>
          {/* Names the winner outright. The scores above imply it, but this is the
              one moment in a match worth stating rather than leaving to arithmetic —
              and the banner that used to say it was removed with the old layout. */}
          <div className={styles.winner}>
            {team0Score === team1Score ? 'Match drawn' : `${team0Score > team1Score ? team0Name : team1Name} wins`}
          </div>
          <button
            type="button"
            className={styles.rematchBtn}
            onClick={rematch.onPlayAgain}
            disabled={rematch.iAmReady}
          >
            {rematch.iAmReady ? 'Waiting for the others…' : 'Play again'}
          </button>
          <div className={styles.rematchCount}>
            {rematch.ready} / {rematch.total} ready
          </div>
        </div>
      )}
    </Overlay>
  );
}
