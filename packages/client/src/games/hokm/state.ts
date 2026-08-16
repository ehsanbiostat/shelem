import type { hokm } from '@shelem/shared';
import type { BaseStateJSON, CommonPhaseJSON } from '../../roomState';

type HokmTableConfig = hokm.HokmTableConfig;
type HandOutcome = hokm.HandOutcome;

export interface HakemRevealJSON {
  seat: number;
  suit: string;
  rank: string;
  /** Who held that seat when the card turned up. Captured server-side, because
   * the draw can move people afterwards — see `swappedSeatA`. */
  name: string;
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
  /** The two seats that changed places so the Aces' partnership could sit
   * opposite each other, or -1 when nobody had to move. */
  swappedSeatA: number;
  swappedSeatB: number;
  handHistory: HokmHandResultJSON[];
  config: HokmTableConfig;
}

/** How a finished hand reads on the scoreboard. */
export function outcomeLabel(outcome: HandOutcome): string {
  if (outcome === 'kot') return 'Kot';
  if (outcome === 'hakemKoti') return 'Hâkem Koti';
  return '';
}
