import { useMemo, useState } from 'react';
import { hokm } from '@shelem/shared';
import styles from '../shelem/ConfigureTable.module.css';

const {
  DEFAULT_HOKM_CONFIG,
  HOKM_TARGET_PRESETS,
  MAX_HOKM_TARGET,
  MIN_HOKM_TARGET,
  MIN_HOKM_VALUE,
  validateHokmConfig,
} = hokm;
type HokmTableConfig = hokm.HokmTableConfig;
type HakemSelection = hokm.HakemSelection;
type ShuffleMode = HokmTableConfig['shuffleMode'];

/** The form's own shape. Numbers are held as strings while they're being typed, so a
 * half-entered "1" on the way to 11 isn't treated as a value of 1 — it just fails
 * validation until the rest arrives. */
interface Draft extends Omit<HokmTableConfig, 'targetScore' | 'handValue' | 'kotValue' | 'hakemKotiValue'> {
  targetScore: string;
  handValue: string;
  kotValue: string;
  hakemKotiValue: string;
}

function toDraft(config: HokmTableConfig): Draft {
  return {
    ...config,
    targetScore: String(config.targetScore),
    handValue: String(config.handValue),
    kotValue: String(config.kotValue),
    hakemKotiValue: String(config.hakemKotiValue),
  };
}

/** An empty or half-typed field parses to NaN, which validateHokmConfig rejects for
 * not being a whole number — so there's no separate "is it a number yet" check here. */
function toConfig(draft: Draft): HokmTableConfig {
  return {
    ...draft,
    targetScore: Number(draft.targetScore),
    handValue: Number(draft.handValue),
    kotValue: Number(draft.kotValue),
    hakemKotiValue: Number(draft.hakemKotiValue),
  };
}

/** True when everything except the match length is the traditional ruleset — which is
 * what the presets set, and what decides whether the custom section starts open. */
function isDefaultRules(config: HokmTableConfig): boolean {
  const { targetScore: _ignored, ...rules } = config;
  const { targetScore: _alsoIgnored, ...defaults } = DEFAULT_HOKM_CONFIG;
  return (Object.keys(defaults) as (keyof typeof defaults)[]).every((key) => rules[key] === defaults[key]);
}

const HAKEM_OPTIONS: { value: HakemSelection; label: string; hint: string }[] = [
  {
    value: 'aceDealSeats',
    label: 'Ace',
    hint: 'Cards go face up until an Ace lands. That player is Hâkem; partners stay whoever sits opposite.',
  },
  {
    value: 'aceDealTeams',
    label: 'Ace + teams',
    hint: 'The draw carries on to a second Ace, and those two become partners — so the cards decide the teams, not the seating.',
  },
  {
    value: 'random',
    label: 'Random',
    hint: 'No ceremony. A Hâkem is drawn and the hand begins.',
  },
];

export interface ConfigureTableProps {
  initial: HokmTableConfig;
  title: string;
  subtitle: string;
  submitLabel: string;
  onSubmit: (config: HokmTableConfig) => void;
  /** Omitted for the rematch, where there is nowhere to go back to. */
  onCancel?: () => void;
}

/**
 * The Hokm rules screen, shown before a table exists — and again between matches,
 * when a rematch draws a new host and hands them the same screen.
 *
 * Validates with the very same function the server enforces (`validateHokmConfig`),
 * so the host is told why a combination is refused while they're typing rather than
 * after they submit; the server still has the final say.
 */
export function ConfigureTable({ initial, title, subtitle, submitLabel, onSubmit, onCancel }: ConfigureTableProps) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));
  const [showCustom, setShowCustom] = useState(() => !isDefaultRules(initial));

  const validation = useMemo(() => validateHokmConfig(toConfig(draft)), [draft]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  /** Presets are a whole ruleset, not just a number: picking one puts every other rule
   * back to the traditional value, so "Standard" always means the same table. */
  function applyPreset(targetScore: number) {
    setDraft(toDraft({ ...DEFAULT_HOKM_CONFIG, targetScore }));
  }

  const activePreset = isDefaultRules(toConfig(draft))
    ? HOKM_TARGET_PRESETS.find((p) => String(p.targetScore) === draft.targetScore)
    : undefined;

  const selectedHakem = HAKEM_OPTIONS.find((o) => o.value === draft.hakemSelection);

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
            {HOKM_TARGET_PRESETS.map((preset) => (
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
              min={MIN_HOKM_TARGET}
              max={MAX_HOKM_TARGET}
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

            <div className={styles.row}>
              <span className={styles.rowLabel}>Choosing the Hâkem</span>
              <div className={styles.segmented}>
                {HAKEM_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`${styles.segment} ${draft.hakemSelection === option.value ? styles.segmentActive : ''}`}
                    onClick={() => set('hakemSelection', option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <p className={styles.hint}>{selectedHakem?.hint}</p>

            <label className={styles.row}>
              <span className={styles.rowLabel}>A won hand scores</span>
              <input
                className={styles.number}
                type="number"
                inputMode="numeric"
                step={1}
                min={MIN_HOKM_VALUE}
                value={draft.handValue}
                onChange={(e) => set('handValue', e.target.value)}
              />
            </label>

            <label className={styles.row}>
              <span className={styles.rowLabel}>Kot scores</span>
              <input
                className={styles.number}
                type="number"
                inputMode="numeric"
                step={1}
                min={MIN_HOKM_VALUE}
                value={draft.kotValue}
                onChange={(e) => set('kotValue', e.target.value)}
              />
            </label>
            <p className={styles.hint}>The Hâkem's team takes the first seven tricks and the opponents none.</p>

            <label className={styles.row}>
              <span className={styles.rowLabel}>Hâkem Koti scores</span>
              <input
                className={styles.number}
                type="number"
                inputMode="numeric"
                step={1}
                min={MIN_HOKM_VALUE}
                value={draft.hakemKotiValue}
                onChange={(e) => set('hakemKotiValue', e.target.value)}
              />
            </label>
            <p className={styles.hint}>The opponents do the same to the Hâkem — traditionally the dearest result.</p>

            <div className={styles.row}>
              <span className={styles.rowLabel}>Shuffle</span>
              <div className={styles.segmented}>
                {(
                  [
                    ['random', 'Random'],
                    ['table', 'Table'],
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
              {draft.shuffleMode === 'random'
                ? 'Every hand is dealt from a freshly randomised deck.'
                : 'Each hand is dealt from the last one, lightly shuffled — suits stay grouped, as at a real table.'}
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
