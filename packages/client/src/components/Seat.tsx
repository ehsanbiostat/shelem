import type { Team } from '@shelem/shared';
import styles from './Seat.module.css';
import { Card } from './Card.js';

export interface SeatProps {
  name: string;
  team: Team;
  connected: boolean;
  handSize: number;
  isDealer: boolean;
  isTurn: boolean;
  isDeclarer: boolean;
  empty: boolean;
}

export function Seat({ name, team, connected, handSize, isDealer, isTurn, isDeclarer, empty }: SeatProps) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <div className={styles.seat}>
      <div className={`${styles.avatar} ${isTurn ? styles.turn : ''} ${empty ? styles.empty : ''}`}>
        {empty ? '' : initial}
        {isDealer && !empty && <span className={styles.dealerChip}>D</span>}
      </div>
      <div className={styles.name}>
        <span className={`${styles.connectedDot} ${connected ? '' : styles.offline}`} />
        {empty ? 'Waiting…' : name}
      </div>
      {!empty && <span className={styles.team}>Team {team === 0 ? 'A' : 'B'}</span>}
      {isDeclarer && <span className={styles.declarerBadge}>Declarer</span>}
      {!empty && handSize > 0 && (
        <div className={styles.handFan}>
          {Array.from({ length: Math.min(handSize, 6) }).map((_, i) => (
            <Card key={i} card={{ suit: 'spades', rank: '2' }} size="sm" faceDown />
          ))}
        </div>
      )}
    </div>
  );
}
