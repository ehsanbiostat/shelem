import { shelem } from '@shelem/shared';

const { DEFAULT_TABLE_CONFIG } = shelem;
type TableConfig = shelem.TableConfig;
import styles from './RulesSummary.module.css';

/** Every rule that differs from the traditional ruleset, phrased the way a player
 * would say it. Rules left at their default are not listed — a table playing the
 * standard game should read as "playing to N", not as a wall of confirmations. */
function houseRules(config: TableConfig): string[] {
  const rules: string[] = [];

  if (config.shelemValue !== DEFAULT_TABLE_CONFIG.shelemValue) {
    rules.push(`Shelem ${config.shelemValue}`);
  }
  if (config.sarShelemValue !== DEFAULT_TABLE_CONFIG.sarShelemValue) {
    rules.push(`Sar-Shelem ${config.sarShelemValue}`);
  }
  if (config.sarShelemTakesWidow) {
    rules.push('Sar-Shelem exchanges the widow');
  }
  if (!config.doubleNegativeEnabled) {
    rules.push('No double negative');
  } else if (config.doubleNegativeThreshold !== DEFAULT_TABLE_CONFIG.doubleNegativeThreshold) {
    rules.push(`Doubles below ${config.doubleNegativeThreshold}`);
  }
  if (config.shuffleMode === 'random') {
    rules.push('Random shuffle every hand');
  }

  if (config.turnLimitSeconds !== DEFAULT_TABLE_CONFIG.turnLimitSeconds) {
    rules.push(
      config.turnLimitSeconds === 0 ? 'No turn limit' : `${config.turnLimitSeconds}s per turn`,
    );
  }

  return rules;
}

export interface RulesSummaryProps {
  config: TableConfig;
}

/**
 * The table's rules, read-only, shown on the felt while the table fills up.
 *
 * Rules are settled on the create-table screen before the room exists and are then
 * fixed for the whole match, so there is nothing to edit here — not even for the host.
 * This exists so the three people who joined by code can see what they've joined
 * before the first deal, rather than finding out from the scoreboard later.
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
