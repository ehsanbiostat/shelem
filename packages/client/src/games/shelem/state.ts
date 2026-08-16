import type { shelem } from '@shelem/shared';
import type { BaseStateJSON, CommonPhaseJSON, TrickPlayJSON } from '../../roomState';

type Bid = shelem.Bid;
type TableConfig = shelem.TableConfig;

export interface BidRecordJSON {
  seat: number;
  bidType: 'numeric' | 'shelem' | 'sarShelem' | 'pass';
  amount: number;
}

export interface ShelemHandResultJSON {
  handNumber: number;
  declarerSeat: number;
  bidType: 'numeric' | 'shelem' | 'sarShelem';
  bidAmount: number;
  declarerMadeBid: boolean;
  team0Delta: number;
  team1Delta: number;
  team0Total: number;
  team1Total: number;
}

/** Mirrors the server's GameState — see packages/server/src/schema/GameState.ts. */
export interface ShelemStateJSON extends BaseStateJSON {
  phase: CommonPhaseJSON | 'bidding' | 'widow';
  declarerSeat: number;
  bidHistory: BidRecordJSON[];
  winningBidType: string;
  winningBidAmount: number;
  tricksPlayedThisHand: number;
  lastTrick: TrickPlayJSON[];
  lastTrickPoints: number;
  handHistory: ShelemHandResultJSON[];
  /** The server's schema mirror of the shared TableConfig — same fields, so the
   * shared type stands in for it directly. */
  config: TableConfig;
  declarerPointsCollected: number;
  defenderPointsCollected: number;
}

export function winningBidFrom(state: ShelemStateJSON): Bid | null {
  if (!state.winningBidType) return null;
  if (state.winningBidType === 'numeric') return { type: 'numeric', amount: state.winningBidAmount };
  if (state.winningBidType === 'shelem') return { type: 'shelem' };
  if (state.winningBidType === 'sarShelem') return { type: 'sarShelem' };
  return null;
}

export function bidLabel(bid: Bid): string {
  if (bid.type === 'numeric') return String(bid.amount);
  if (bid.type === 'shelem') return 'Shelem';
  if (bid.type === 'sarShelem') return 'Sar-Shelem';
  return 'Pass';
}
