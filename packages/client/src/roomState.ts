import type { Bid, Card, Rank, Seat, Suit } from '@shelem/shared';

export interface PlayerInfoJSON {
  sessionId: string;
  name: string;
  seat: number;
  connected: boolean;
  handSize: number;
}

export interface BidRecordJSON {
  seat: number;
  bidType: 'numeric' | 'shelem' | 'sarShelem' | 'pass';
  amount: number;
}

export interface TrickPlayJSON {
  seat: number;
  suit: string;
  rank: string;
}

export interface SeatSwapRequestJSON {
  fromSeat: number;
  toSeat: number;
}

export interface HandResultJSON {
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

export interface GameStateJSON {
  players: PlayerInfoJSON[];
  phase: 'lobby' | 'dealing' | 'bidding' | 'widow' | 'playing' | 'handComplete' | 'matchComplete';
  dealerSeat: number;
  currentTurnSeat: number;
  declarerSeat: number;
  bidHistory: BidRecordJSON[];
  winningBidType: string;
  winningBidAmount: number;
  trumpSuit: string;
  currentTrick: TrickPlayJSON[];
  tricksPlayedThisHand: number;
  lastTrick: TrickPlayJSON[];
  lastTrickWinnerSeat: number;
  lastTrickPoints: number;
  team0Score: number;
  team1Score: number;
  matchTargetScore: number;
  handHistory: HandResultJSON[];
  declarerPointsCollected: number;
  defenderPointsCollected: number;
  pendingSeatSwap?: SeatSwapRequestJSON;
  handNumber: number;
  hostSessionId: string;
}

export function toCard(item: { suit: string; rank: string }): Card {
  return { suit: item.suit as Suit, rank: item.rank as Rank };
}

export function winningBidFrom(state: GameStateJSON): Bid | null {
  if (!state.winningBidType) return null;
  if (state.winningBidType === 'numeric') return { type: 'numeric', amount: state.winningBidAmount };
  if (state.winningBidType === 'shelem') return { type: 'shelem' };
  if (state.winningBidType === 'sarShelem') return { type: 'sarShelem' };
  return null;
}

export function seatOf(sessionId: string, players: PlayerInfoJSON[]): Seat | null {
  const player = players.find((p) => p.sessionId === sessionId);
  return player ? (player.seat as Seat) : null;
}
