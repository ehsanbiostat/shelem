import type { Card } from '../core/types.js';
import type { TableConfig } from './config.js';
import type { Bid } from './types.js';

export const TRICK_BONUS = 5;
export const TRICKS_PER_HAND = 13; // 12 played + the buried widow-discard trick
export const TOTAL_HAND_POINTS = 165;
/** Default threshold: a declaring team that collects fewer points than this loses double their bid
 * instead of single. Just over half of the 165 available, so the rule bites on a
 * hand badly misjudged rather than one narrowly missed: fall short of the bid and
 * it costs the bid, fail to take even half the points and it costs twice. */
export const DOUBLE_NEGATIVE_THRESHOLD = 85;
/** What Shelem and Sar-Shelem pay by default, won or lost. Both claim every point in
 * the hand, so both are worth the same; Sar-Shelem outranks Shelem in the bidding by
 * being the harder way to do it (no widow exchange), not the richer one. A table can
 * price them apart — see TableConfig. */
export const SLAM_STAKE = 330;

export function cardPoints(card: Card): number {
  if (card.rank === 'A' || card.rank === '10') return 10;
  if (card.rank === '5') return 5;
  return 0;
}

/** Points value of one completed trick (4 cards) including the flat per-trick bonus. */
export function trickPoints(cards: Card[]): number {
  return TRICK_BONUS + cards.reduce((sum, c) => sum + cardPoints(c), 0);
}

export interface HandScore {
  declarerDelta: number;
  defenderDelta: number;
  declarerMadeBid: boolean;
  /** True when the loss was doubled for falling under the table's double-negative threshold. */
  declarerDoubled: boolean;
}

/** The parts of a table's rules that scoring depends on. */
export type ScoringConfig = Pick<
  TableConfig,
  'shelemValue' | 'sarShelemValue' | 'doubleNegativeEnabled' | 'doubleNegativeThreshold'
>;

/**
 * Resolves the score delta for both teams at the end of a hand.
 *
 * - The defending team always scores exactly the points they collected in tricks,
 *   independent of anything the declaring team does — including the double below,
 *   which is a penalty rather than a transfer.
 * - A numeric bid succeeds if the declarer's team collected at least the bid amount;
 *   they score exactly the bid amount either way (excess points don't matter), or
 *   lose exactly the bid amount on failure.
 * - Shelem and Sar-Shelem both require collecting all 165 points, and each pays its
 *   configured value either way. By default the two are worth the same: they differ
 *   in how they are played, not in what they are worth — see docs/game-rules.md.
 * - Any failed contract where the declaring team collected fewer than the table's
 *   double-negative threshold loses *double* the stake. This applies at every tier,
 *   so a failed Shelem under the threshold is -330 and a Sar-Shelem -660.
 *
 * The double can never collide with a made contract: making a numeric bid needs at
 * least BID_FLOOR (100) points and a Shelem needs all 165, and validateTableConfig
 * caps the threshold at BID_FLOOR — so anything under it has failed by definition.
 */
export function resolveHandScore(
  bid: Exclude<Bid, { type: 'pass' }>,
  declarerPointsCollected: number,
  defenderPointsCollected: number,
  config: ScoringConfig,
): HandScore {
  const defenderDelta = defenderPointsCollected;

  const stake =
    bid.type === 'numeric'
      ? bid.amount
      : bid.type === 'shelem'
        ? config.shelemValue
        : config.sarShelemValue;
  const made =
    bid.type === 'numeric'
      ? declarerPointsCollected >= bid.amount
      : declarerPointsCollected === TOTAL_HAND_POINTS;

  if (made) return { declarerDelta: stake, defenderDelta, declarerMadeBid: true, declarerDoubled: false };

  const doubled =
    config.doubleNegativeEnabled && declarerPointsCollected < config.doubleNegativeThreshold;
  return {
    declarerDelta: doubled ? -stake * 2 : -stake,
    defenderDelta,
    declarerMadeBid: false,
    declarerDoubled: doubled,
  };
}

export interface MatchScores {
  team0: number;
  team1: number;
}

export function isMatchComplete(scores: MatchScores, targetScore: number): boolean {
  return scores.team0 >= targetScore || scores.team1 >= targetScore;
}
