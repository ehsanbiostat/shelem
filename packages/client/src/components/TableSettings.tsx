import { useEffect, useState } from 'react';
import styles from './TableSettings.module.css';

/** Handy round numbers, either side of the default. 1650 is 10× the 165 points a
 * single hand is worth (see docs/game-rules.md); the other two are the obvious
 * shorter and longer matches. They're shortcuts only — the field beside them
 * takes any whole number from MIN_TARGET_SCORE up. */
const PRESETS = [1000, 1650, 2000];

/** Mirrors the server's floor (ShelemRoom's MIN_TARGET_SCORE): one hand's worth
 * of points, below which a match would be settled by a single deal. The server
 * is the one that actually enforces it; this only shapes the input. */
const MIN_TARGET_SCORE = 165;

export interface TableSettingsProps {
  targetScore: number;
  /** Only the player who created the table may change these — everyone else sees
   * the same values read-only, so the whole table knows what it's playing to
   * before the first deal rather than finding out from the scoreboard later. */
  isHost: boolean;
  onChangeTargetScore: (targetScore: number) => void;
}

export function TableSettings({ targetScore, isHost, onChangeTargetScore }: TableSettingsProps) {
  // Kept local while typing so a half-entered number (e.g. "16" on the way to
  // 1650) isn't pushed to the server as a real setting. Resyncs whenever the
  // authoritative value changes — including when another client's change arrives.
  const [custom, setCustom] = useState(String(targetScore));
  useEffect(() => setCustom(String(targetScore)), [targetScore]);

  if (!isHost) {
    return (
      <div className={styles.panel}>
        <span className={styles.label}>Playing to</span>
        <span className={styles.readOnly}>{targetScore}</span>
      </div>
    );
  }

  function commitCustom() {
    const parsed = Number(custom);
    // The server is the authority and rejects with a reason; this only avoids
    // sending obvious garbage, and snaps the field back rather than leaving a
    // value on screen that was never accepted.
    if (Number.isInteger(parsed) && parsed >= MIN_TARGET_SCORE) onChangeTargetScore(parsed);
    else setCustom(String(targetScore));
  }

  return (
    <div className={styles.panel}>
      <span className={styles.label}>Playing to</span>

      <input
        className={styles.custom}
        type="number"
        inputMode="numeric"
        step={1}
        min={MIN_TARGET_SCORE}
        value={custom}
        aria-label="Target score"
        onChange={(e) => setCustom(e.target.value)}
        onBlur={commitCustom}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />

      <div className={styles.presets}>
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className={`${styles.preset} ${preset === targetScore ? styles.presetActive : ''}`}
            onClick={() => onChangeTargetScore(preset)}
          >
            {preset}
          </button>
        ))}
      </div>
    </div>
  );
}
