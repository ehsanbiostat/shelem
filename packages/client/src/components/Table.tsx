import type { ReactNode } from 'react';
import type { Seat as SeatIndex, Team } from '@shelem/shared';
import { teamForSeat } from '@shelem/shared';
import styles from './Table.module.css';
import { Seat } from './Seat.js';
import { TableFeltMotif } from './TableFeltMotif.js';

export interface TablePlayer {
  seat: SeatIndex;
  name: string;
  connected: boolean;
  handSize: number;
}

export interface TableProps {
  mySeat: SeatIndex;
  players: TablePlayer[];
  dealerSeat: SeatIndex;
  currentTurnSeat: SeatIndex;
  declarerSeat: SeatIndex | -1;
  center: ReactNode;
}

/** Screen position for each seat relative to the local player, who is always drawn
 * at the bottom. Turn order is clockwise, so the next seat appears on-screen left
 * (standard 4-player card table convention). */
function screenSlotFor(seat: SeatIndex, mySeat: SeatIndex): 'bottom' | 'left' | 'top' | 'right' {
  const offset = ((seat - mySeat + 4) % 4) as 0 | 1 | 2 | 3;
  return (['bottom', 'left', 'top', 'right'] as const)[offset];
}

export function Table({ mySeat, players, dealerSeat, currentTurnSeat, declarerSeat, center }: TableProps) {
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
        return (
          <div key={seat} className={`${styles.seatSlot} ${styles[slot]}`}>
            <Seat
              name={player?.name ?? ''}
              team={teamForSeat(seat) as Team}
              connected={player?.connected ?? false}
              handSize={slot === 'bottom' ? 0 : (player?.handSize ?? 0)}
              isDealer={seat === dealerSeat}
              isTurn={seat === currentTurnSeat}
              isDeclarer={seat === declarerSeat}
              empty={!player}
            />
          </div>
        );
      })}

      <div className={styles.center}>{center}</div>
    </div>
  );
}
