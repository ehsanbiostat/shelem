import type { Team } from '../core/types.js';
import type { HokmTableConfig } from './config.js';
import type { HandOutcome } from './types.js';

/** Tricks a team must take to win the hand. The other six are simply never played
 * once the seventh lands — thirteen exist, but the hand is already decided. */
export const HOKM_TRICKS_TO_WIN = 7;

export interface HokmHandResult {
  team0Delta: number;
  team1Delta: number;
  winningTeam: Team;
  outcome: HandOutcome;
}

/** The parts of a table's rules that scoring depends on. */
export type HokmScoringConfig = Pick<HokmTableConfig, 'handValue' | 'kotValue' | 'hakemKotiValue'>;

export interface HokmHandTally {
  team0Tricks: number;
  team1Tricks: number;
  /** The team the Hâkem plays for — the one that chose trump, and the one a
   * Hâkem Koti is scored against. */
  hakemTeam: Team;
}

/**
 * Resolves the score at the end of a Hokm hand.
 *
 * Only the winning side scores; there is nothing to collect for coming second, which
 * is the whole difference from Shelem's card-point scoring. Which of the three values
 * applies turns on one question — did the losers take a single trick?
 *
 * That test is exact rather than approximate. A team reaches seven with the other on
 * zero only by taking the first seven in a row, so "losers on nothing" and "the first
 * seven tricks" are the same event, and there's no need to track when each trick fell.
 */
export function resolveHokmHand(tally: HokmHandTally, config: HokmScoringConfig): HokmHandResult {
  const { team0Tricks, team1Tricks, hakemTeam } = tally;

  if (Math.max(team0Tricks, team1Tricks) < HOKM_TRICKS_TO_WIN) {
    throw new Error(
      `Hand is not over: neither team has ${HOKM_TRICKS_TO_WIN} tricks (${team0Tricks}-${team1Tricks})`,
    );
  }

  const winningTeam: Team = team0Tricks >= HOKM_TRICKS_TO_WIN ? 0 : 1;
  const losingTricks = winningTeam === 0 ? team1Tricks : team0Tricks;

  const outcome: HandOutcome =
    losingTricks > 0 ? 'normal' : winningTeam === hakemTeam ? 'kot' : 'hakemKoti';

  const value =
    outcome === 'normal' ? config.handValue : outcome === 'kot' ? config.kotValue : config.hakemKotiValue;

  return {
    team0Delta: winningTeam === 0 ? value : 0,
    team1Delta: winningTeam === 1 ? value : 0,
    winningTeam,
    outcome,
  };
}

/**
 * Who holds the Hâkem's chair for the next hand.
 *
 * Winning keeps it — a Hâkem who keeps choosing well keeps choosing — and losing
 * passes it on round the table. This is the one piece of Hokm that carries between
 * hands, and it's why a strong hand is worth more than the point it scores.
 */
export function nextHakemSeat(hakemSeat: number, hakemTeamWon: boolean): number {
  return hakemTeamWon ? hakemSeat : (hakemSeat + 1) % 4;
}

export interface HokmMatchScores {
  team0: number;
  team1: number;
}

export function isHokmMatchComplete(scores: HokmMatchScores, targetScore: number): boolean {
  return scores.team0 >= targetScore || scores.team1 >= targetScore;
}
