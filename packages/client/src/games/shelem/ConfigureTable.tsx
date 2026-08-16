import { useMemo, useState } from 'react';
import { shelem, TURN_LIMIT_PRESETS } from '@shelem/shared';

const {
  DEFAULT_TABLE_CONFIG,
  MAX_TARGET_SCORE,
  MIN_SLAM_VALUE,
  MIN_TARGET_SCORE,
  TARGET_SCORE_PRESETS,
  validateTableConfig,
} = shelem;
type ShuffleMode = shelem.ShuffleMode;
type TableConfig = shelem.TableConfig;
import styles from './ConfigureTable.module.css';

/** The form's own shape. Numbers are held as strings while they're being typed, so a
 * half-entered "16" on the way to 1165 isn't treated as a target score of 16 — it just
 * fails validation until the rest arrives. */
interface Draft extends Omit<TableConfig, 'targetScore' | 'shelemValue' | 'sarShelemValue' | 'doubleNegativeThreshold' | 'turnLimitSeconds'> {
  targetScore: string;
  turnLimitSeconds: string;
  shelemValue: string;
  sarShelemValue: string;
  doubleNegativeThreshold: string;
}

function toDraft(config: TableConfig): Draft {
  return {
    ...config,
    targetScore: String(config.targetScore),
    turnLimitSeconds: String(config.turnLimitSeconds),
    shelemValue: String(config.shelemValue),
    sarShelemValue: String(config.sarShelemValue),
    doubleNegativeThreshold: String(config.doubleNegativeThreshold),
  };
}

/** An empty or half-typed field parses to NaN, which validateTableConfig rejects for
 * not being a whole number — so there's no separate "is it a number yet" check here. */
function toConfig(draft: Draft): TableConfig {
  return {
    ...draft,
    targetScore: Number(draft.targetScore),
    turnLimitSeconds: Number(draft.turnLimitSeconds),
    shelemValue: Number(draft.shelemValue),
    sarShelemValue: Number(draft.sarShelemValue),
    doubleNegativeThreshold: Number(draft.doubleNegativeThreshold),
  };
}

/** True when everything except the match length is the traditional ruleset — which is
 * what the presets set, and what decides whether the custom section starts open. */
function isDefaultRules(config: TableConfig): boolean {
  const { targetScore: _ignored, ...rules } = config;
  const { targetScore: _alsoIgnored, ...defaults } = DEFAULT_TABLE_CONFIG;
  return (Object.keys(defaults) as (keyof typeof defaults)[]).every((key) => rules[key] === defaults[key]);
}

export interface ConfigureTableProps {
  /** The rules to open with — the last config this browser created a table with, or
   * for a rematch, the ones the finished match was played under. */
  initial: TableConfig;
  title: string;
  subtitle: string;
  submitLabel: string;
  onSubmit: (config: TableConfig) => void;
  /** Omitted for the rematch, where there is nowhere to go back to. */
  onCancel?: () => void;
}

/**
 * The rules screen, shown before a table exists — and again between matches, when a
 * rematch draws a new host and hands them the same screen.
 *
 * A table's rules are fixed for the length of a match, so this is the only place they
 * are ever chosen. It validates with the very same function the server enforces
 * (`validateTableConfig`), so the host is told why a combination is refused while
 * they're typing rather than after they submit; the server still has the final say.
 */
export function ConfigureTable({ initial, title, subtitle, submitLabel, onSubmit, onCancel }: ConfigureTableProps) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));
  const [showCustom, setShowCustom] = useState(() => !isDefaultRules(initial));

  const validation = useMemo(() => validateTableConfig(toConfig(draft)), [draft]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  /** Presets are a whole ruleset, not just a number: picking one puts every other rule
   * back to the traditional value, so "Standard" always means the same table. */
  function applyPreset(targetScore: number) {
    setDraft(toDraft({ ...DEFAULT_TABLE_CONFIG, targetScore }));
  }

  const activePreset = isDefaultRules(toConfig(draft))
    ? TARGET_SCORE_PRESETS.find((p) => String(p.targetScore) === draft.targetScore)
    : undefined;

  return (
    <div className={styles.screen}>
      <form
        className={styles.card}
        onSubmit={(e) => {
          e.preventDefault();
          if (validation.ok) onSubmit(validation.config);
        }}
      >
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>{subtitle}</p>

        <fieldset className={styles.group}>
          <legend className={styles.legend}>Match length</legend>
          <div className={styles.presets}>
            {TARGET_SCORE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className={`${styles.preset} ${activePreset === preset ? styles.presetActive : ''}`}
                onClick={() => applyPreset(preset.targetScore)}
              >
                <span className={styles.presetName}>{preset.label}</span>
                <span className={styles.presetScore}>{preset.targetScore}</span>
              </button>
            ))}
          </div>

          <label className={styles.row}>
            <span className={styles.rowLabel}>Play to</span>
            <input
              className={styles.number}
              type="number"
              inputMode="numeric"
              step={1}
              min={MIN_TARGET_SCORE}
              max={MAX_TARGET_SCORE}
              value={draft.targetScore}
              onChange={(e) => set('targetScore', e.target.value)}
            />
          </label>
        </fieldset>

        <button
          type="button"
          className={styles.disclosure}
          aria-expanded={showCustom}
          onClick={() => setShowCustom((open) => !open)}
        >
          {showCustom ? '▾' : '▸'} House rules
          {!showCustom && !isDefaultRules(toConfig(draft)) && <span className={styles.modified}>modified</span>}
        </button>

        {showCustom && (
          <fieldset className={styles.group}>
            <legend className={styles.legend}>House rules</legend>

            <label className={styles.row}>
              <span className={styles.rowLabel}>Shelem is worth</span>
              <input
                className={styles.number}
                type="number"
                inputMode="numeric"
                step={5}
                min={MIN_SLAM_VALUE}
                value={draft.shelemValue}
                onChange={(e) => set('shelemValue', e.target.value)}
              />
            </label>

            <label className={styles.row}>
              <span className={styles.rowLabel}>Sar-Shelem is worth</span>
              <input
                className={styles.number}
                type="number"
                inputMode="numeric"
                step={5}
                min={MIN_SLAM_VALUE}
                value={draft.sarShelemValue}
                onChange={(e) => set('sarShelemValue', e.target.value)}
              />
            </label>

            <label className={styles.check}>
              <input
                type="checkbox"
                checked={draft.sarShelemTakesWidow}
                onChange={(e) => set('sarShelemTakesWidow', e.target.checked)}
              />
              <span>
                Sar-Shelem exchanges the widow
                <span className={styles.hint}>
                  Off by default: the declarer is shown the four cards and they're buried unchosen.
                </span>
              </span>
            </label>

            <label className={styles.check}>
              <input
                type="checkbox"
                checked={draft.doubleNegativeEnabled}
                onChange={(e) => set('doubleNegativeEnabled', e.target.checked)}
              />
              <span>
                Double negative
                <span className={styles.hint}>Fail a contract badly enough and the loss doubles.</span>
              </span>
            </label>

            {draft.doubleNegativeEnabled && (
              <label className={styles.row}>
                <span className={styles.rowLabel}>Doubles below</span>
                <input
                  className={styles.number}
                  type="number"
                  inputMode="numeric"
                  step={5}
                  min={0}
                  value={draft.doubleNegativeThreshold}
                  onChange={(e) => set('doubleNegativeThreshold', e.target.value)}
                />
              </label>
            )}


            <div className={styles.row}>
              <span className={styles.rowLabel}>Turn limit</span>
              <div className={styles.segmented}>
                {TURN_LIMIT_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className={`${styles.segment} ${
                      Number(draft.turnLimitSeconds) === preset.seconds ? styles.segmentActive : ''
                    }`}
                    onClick={() => set('turnLimitSeconds', String(preset.seconds))}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <p className={styles.hint}>
              {Number(draft.turnLimitSeconds) === 0
                ? 'No clock — the table waits for whoever is to act, however long that takes.'
                : `A player who doesn't act in ${draft.turnLimitSeconds}s has the turn played for them. Bidding and other judgements get twice as long.`}
            </p>

            <div className={styles.row}>
              <span className={styles.rowLabel}>Shuffle</span>
              <div className={styles.segmented}>
                {(
                  [
                    ['table', 'Table'],
                    ['random', 'Random'],
                  ] as [ShuffleMode, string][]
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    className={`${styles.segment} ${draft.shuffleMode === mode ? styles.segmentActive : ''}`}
                    onClick={() => set('shuffleMode', mode)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <p className={styles.hint}>
              {draft.shuffleMode === 'table'
                ? 'Each hand is dealt from the last one, lightly shuffled — suits stay grouped, as at a real table.'
                : 'Every hand is dealt from a freshly randomised deck.'}
            </p>
          </fieldset>
        )}

        {!validation.ok && <p className={styles.error}>{validation.error}</p>}

        <button type="submit" className={styles.primaryBtn} disabled={!validation.ok}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className={styles.secondaryBtn} onClick={onCancel}>
            Back
          </button>
        )}
      </form>
    </div>
  );
}
