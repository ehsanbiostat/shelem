import type { Bid, Card } from './types.js';

export const TRICK_BONUS = 5;
export const TRICKS_PER_HAND = 13; // 12 played + the buried widow-discard trick
export const TOTAL_HAND_POINTS = 165;

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
}

/**
 * Resolves the score delta for both teams at the end of a hand.
 *
 * - The defending team always scores exactly the points they collected in tricks,
 *   independent of whether the declarer's team made their bid.
 * - A numeric bid succeeds if the declarer's team collected at least the bid amount;
 *   they score exactly the bid amount either way (excess points don't matter), or
 *   lose exactly the bid amount on failure.
 * - Shelem/Sar-Shelem require collecting all 165 points; success/failure pays the
 *   fixed amount for that tier (+/-165 or +/-330).
 */
export function resolveHandScore(
  bid: Exclude<Bid, { type: 'pass' }>,
  declarerPointsCollected: number,
  defenderPointsCollected: number,
): HandScore {
  const defenderDelta = defenderPointsCollected;

  if (bid.type === 'numeric') {
    const made = declarerPointsCollected >= bid.amount;
    return { declarerDelta: made ? bid.amount : -bid.amount, defenderDelta, declarerMadeBid: made };
  }

  const made = declarerPointsCollected === TOTAL_HAND_POINTS;
  const stake = bid.type === 'shelem' ? 165 : 330;
  return { declarerDelta: made ? stake : -stake, defenderDelta, declarerMadeBid: made };
}

export interface MatchScores {
  team0: number;
  team1: number;
}

export function isMatchComplete(scores: MatchScores, targetScore: number): boolean {
  return scores.team0 >= targetScore || scores.team1 >= targetScore;
}
