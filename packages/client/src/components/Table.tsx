import type { ReactNode } from 'react';
import type { Seat as SeatIndex } from '@shelem/shared';
import styles from './Table.module.css';
import { Seat } from './Seat.js';
import { TableFeltMotif } from './TableFeltMotif.js';

export interface TablePlayer {
  seat: SeatIndex;
  name: string;
  connected: boolean;
  handSize: number;
  bidLabel?: string;
}

export interface TableProps {
  mySeat: SeatIndex;
  players: TablePlayer[];
  dealerSeat: SeatIndex;
  currentTurnSeat: SeatIndex;
  declarerSeat: SeatIndex | -1;
  biddingInProgress: boolean;
  center: ReactNode;
  /** The local player's own hand (or widow-discard picker), anchored flush to the
   * felt's bottom edge — on Trickster's table this is the same surface as the rest
   * of the game, not a separate panel below it. */
  bottomOverlay?: ReactNode;
  /** Small overlay pinned to the felt's bottom-left corner — the score panel. Kept
   * out of the bottom-center hand's way rather than occupying its own row above
   * the table. */
  cornerPanel?: ReactNode;
}

/** Screen position for each seat relative to the local player, who is always drawn
 * at the bottom. Turn order is clockwise, so the next seat appears on-screen left
 * (standard 4-player card table convention). */
function screenSlotFor(seat: SeatIndex, mySeat: SeatIndex): 'bottom' | 'left' | 'top' | 'right' {
  const offset = ((seat - mySeat + 4) % 4) as 0 | 1 | 2 | 3;
  return (['bottom', 'left', 'top', 'right'] as const)[offset];
}

export function Table({
  mySeat,
  players,
  dealerSeat,
  currentTurnSeat,
  declarerSeat,
  biddingInProgress,
  center,
  bottomOverlay,
  cornerPanel,
}: TableProps) {
  const bySeat = new Map(players.map((p) => [p.seat, p]));

  return (
    <div className={styles.tableWrap}>
      <div className={styles.felt}>
        <div className={styles.feltPattern}>
          <TableFeltMotif />
        </div>
      </div>

      {([0, 1, 2, 3] as SeatIndex[]).map((seat) => {
        const player = bySeat.get(seat);
        const slot = screenSlotFor(seat, mySeat);
        const isTurn = seat === currentTurnSeat;
        return (
          <div key={seat} className={`${styles.seatSlot} ${styles[slot]}`}>
            <Seat
              name={player?.name ?? ''}
              connected={player?.connected ?? false}
              handSize={slot === 'bottom' ? 0 : (player?.handSize ?? 0)}
              isDealer={seat === dealerSeat}
              isTurn={isTurn}
              isBiddingTurn={biddingInProgress && isTurn}
              isDeclarer={seat === declarerSeat}
              bidLabel={player?.bidLabel}
              empty={!player}
              slot={slot}
            />
          </div>
        );
      })}

      <div className={styles.center}>{center}</div>

      {cornerPanel && <div className={styles.cornerPanel}>{cornerPanel}</div>}

      {bottomOverlay && <div className={styles.bottomOverlay}>{bottomOverlay}</div>}
    </div>
  );
}
