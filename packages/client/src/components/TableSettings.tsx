import { useEffect, useState } from 'react';
import styles from './TableSettings.module.css';

/** Handy round numbers, either side of the default. 1650 is 10× the 165 points a
 * single hand is worth (see docs/game-rules.md); the other two are the obvious
 * shorter and longer matches. Anything else goes in the custom field. */
const PRESETS = [1000, 1650, 2000];

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
    // Server validates properly (multiple of 5, in range) and rejects with a
    // reason; this only avoids sending obvious garbage on every keystroke.
    if (Number.isFinite(parsed) && parsed > 0) onChangeTargetScore(parsed);
    else setCustom(String(targetScore));
  }

  return (
    <div className={styles.panel}>
      <span className={styles.label}>Playing to</span>

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

      <input
        className={styles.custom}
        type="number"
        step={5}
        min={165}
        value={custom}
        aria-label="Custom target score"
        onChange={(e) => setCustom(e.target.value)}
        onBlur={commitCustom}
        onKeyDown={(e) => e.key === 'Enter' && commitCustom()}
      />
    </div>
  );
}
