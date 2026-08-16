import { hokm } from '@shelem/shared';
import styles from '../shelem/RulesSummary.module.css';

const { DEFAULT_HOKM_CONFIG } = hokm;
type HokmTableConfig = hokm.HokmTableConfig;

const HAKEM_SELECTION_LABEL: Record<hokm.HakemSelection, string> = {
  aceDealTeams: 'Aces choose the Hâkem and the partnerships',
  aceDealSeats: 'Aces choose the Hâkem',
  random: 'Hâkem drawn at random',
};

/** Every rule that differs from the traditional ruleset, phrased the way a player
 * would say it. Rules left at their default are not listed — a table playing the
 * standard game should read as "playing to 7", not as a wall of confirmations. */
function houseRules(config: HokmTableConfig): string[] {
  const rules: string[] = [];

  if (config.handValue !== DEFAULT_HOKM_CONFIG.handValue) {
    rules.push(`A won hand scores ${config.handValue}`);
  }
  if (config.kotValue !== DEFAULT_HOKM_CONFIG.kotValue) {
    rules.push(`Kot scores ${config.kotValue}`);
  }
  if (config.hakemKotiValue !== DEFAULT_HOKM_CONFIG.hakemKotiValue) {
    rules.push(`Hâkem Koti scores ${config.hakemKotiValue}`);
  }
  if (config.hakemSelection !== DEFAULT_HOKM_CONFIG.hakemSelection) {
    rules.push(HAKEM_SELECTION_LABEL[config.hakemSelection]);
  }
  if (config.shuffleMode !== DEFAULT_HOKM_CONFIG.shuffleMode) {
    rules.push('Each hand dealt from the last, lightly shuffled');
  }

  if (config.turnLimitSeconds !== DEFAULT_HOKM_CONFIG.turnLimitSeconds) {
    rules.push(
      config.turnLimitSeconds === 0 ? 'No turn limit' : `${config.turnLimitSeconds}s per turn`,
    );
  }

  return rules;
}

export interface RulesSummaryProps {
  config: HokmTableConfig;
}

/**
 * The table's rules, read-only, shown on the felt while the table fills up. Same
 * job as Shelem's, and it borrows that stylesheet — the rules differ, the panel
 * doesn't.
 */
export function RulesSummary({ config }: RulesSummaryProps) {
  const rules = houseRules(config);

  return (
    <div className={styles.panel}>
      <div className={styles.target}>
        <span className={styles.label}>Playing to</span>
        <span className={styles.score}>{config.targetScore}</span>
      </div>
      {rules.length > 0 && (
        <ul className={styles.rules}>
          {rules.map((rule) => (
            <li key={rule} className={styles.rule}>
              {rule}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
