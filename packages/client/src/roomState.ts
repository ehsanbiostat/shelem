import type { Card, Rank, Seat, Suit } from '@shelem/shared';

/**
 * Hand-written mirrors of the server's synced schema, as it arrives from
 * `state.toJSON()`. Split the same way the server's schema is: what every table
 * has here, and each game's own additions alongside that game's screens.
 */

export interface PlayerInfoJSON {
  sessionId: string;
  name: string;
  seat: number;
  connected: boolean;
  handSize: number;
  wantsRematch: boolean;
  /** Played by the server rather than a person. A bot never connects, so it has
   * no sessionId — this is the only thing separating an occupied bot seat from
   * an empty one. */
  isBot: boolean;
}

/** Somebody is in this seat: a human who joined, or a bot. Mirrors the server's
 * own `isOccupied` — see BaseTableRoom.ts. */
export function isOccupied(player: PlayerInfoJSON): boolean {
  return player.sessionId !== '' || player.isBot;
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

/** The phases every game passes through. Each game's state widens this with its own. */
export type CommonPhaseJSON =
  | 'configuring'
  | 'lobby'
  | 'dealing'
  | 'playing'
  | 'handComplete'
  | 'matchComplete';

/** Mirrors BaseGameState — see packages/server/src/schema/BaseGameState.ts. */
export interface BaseStateJSON {
  players: PlayerInfoJSON[];
  phase: string;
  dealerSeat: number;
  currentTurnSeat: number;
  trumpSuit: string;
  currentTrick: TrickPlayJSON[];
  lastTrick: TrickPlayJSON[];
  lastTrickWinnerSeat: number;
  team0Score: number;
  team1Score: number;
  /** Which team each seat plays for. Read this rather than assuming seat parity —
   * a Hokm table can draw its partnerships from the cards. */
  teamOfSeat: number[];
  pendingSeatSwap?: SeatSwapRequestJSON;
  handNumber: number;
  hostSessionId: string;
}

export function toCard(item: { suit: string; rank: string }): Card {
  return { suit: item.suit as Suit, rank: item.rank as Rank };
}

export function seatOf(sessionId: string, players: PlayerInfoJSON[]): Seat | null {
  const player = players.find((p) => p.sessionId === sessionId);
  return player ? (player.seat as Seat) : null;
}

/** The team a seat plays for, as the server currently has it. Falls back to seat
 * parity for the moment before the first state arrives. */
export function teamOf(state: BaseStateJSON, seat: number): 0 | 1 {
  const team = state.teamOfSeat?.[seat];
  return (team === 0 || team === 1 ? team : seat % 2) as 0 | 1;
}
