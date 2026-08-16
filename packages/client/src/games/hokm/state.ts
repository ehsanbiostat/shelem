import type { hokm } from '@shelem/shared';
import type { BaseStateJSON, CommonPhaseJSON } from '../../roomState';

type HokmTableConfig = hokm.HokmTableConfig;
type HandOutcome = hokm.HandOutcome;

export interface HakemRevealJSON {
  seat: number;
  suit: string;
  rank: string;
}

export interface HokmHandResultJSON {
  handNumber: number;
  hakemSeat: number;
  trumpSuit: string;
  outcome: HandOutcome;
  team0Tricks: number;
  team1Tricks: number;
  team0Delta: number;
  team1Delta: number;
  team0Total: number;
  team1Total: number;
}

/** Mirrors the server's HokmGameState — see packages/server/src/schema/HokmGameState.ts. */
export interface HokmStateJSON extends BaseStateJSON {
  phase: CommonPhaseJSON | 'hakemDraw' | 'declaringTrump';
  hakemSeat: number;
  team0Tricks: number;
  team1Tricks: number;
  hakemDraw: HakemRevealJSON[];
  handHistory: HokmHandResultJSON[];
  config: HokmTableConfig;
}

/** How a finished hand reads on the scoreboard. */
export function outcomeLabel(outcome: HandOutcome): string {
  if (outcome === 'kot') return 'Kot';
  if (outcome === 'hakemKoti') return 'Hâkem Koti';
  return '';
}
