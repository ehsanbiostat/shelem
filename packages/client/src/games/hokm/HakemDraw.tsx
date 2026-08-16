import { motion } from 'framer-motion';
import type { Seat as SeatIndex } from '@shelem/shared';
import { Card } from '../../components/Card.js';
import { toCard } from '../../roomState';
import type { HakemRevealJSON } from './state';
import styles from './HakemDraw.module.css';

export interface HakemDrawProps {
  reveals: HakemRevealJSON[];
  playerNames: Record<number, string>;
  mySeat: SeatIndex;
  /** Set once the draw has produced a Hâkem, so the result can be named. */
  hakemSeat: number;
  /** The two seats that traded places to put the partnership opposite each other,
   * or -1 when nobody moved. */
  swappedSeatA: number;
  swappedSeatB: number;
}

/**
 * The ceremony that opens a match: cards going face up round the table until an
 * Ace turns up, and on a table that draws partnerships from the cards, until a
 * second one does.
 *
 * Rendered from the synced list the server pushes a card at a time, rather than
 * animated from a known result — the point is that all four players watch the same
 * cards land in the same order, which only holds if the server is the one dealing
 * them out.
 */
export function HakemDraw({
  reveals,
  playerNames,
  mySeat,
  hakemSeat,
  swappedSeatA,
  swappedSeatB,
}: HakemDrawProps) {
  const latest = reveals[reveals.length - 1];
  const swapped = swappedSeatA >= 0 && swappedSeatB >= 0;

  return (
    <div className={styles.draw}>
      <div className={styles.big}>Finding the Hâkem</div>
      <div className={styles.hint}>Cards go face up until an Ace lands.</div>

      <div className={styles.strip}>
        {reveals.map((reveal, index) => {
          const isAce = reveal.rank === 'A';
          return (
            <motion.div
              key={`${index}-${reveal.suit}-${reveal.rank}`}
              className={`${styles.slot} ${isAce ? styles.ace : ''}`}
              initial={{ opacity: 0, y: -14, rotate: -6 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              <Card card={toCard(reveal)} size="sm" />
              {/* The name the server captured with the card, not a lookup by seat:
                  the partnership reseat moves people, and a seat lookup would then
                  credit these cards to whoever ended up in that chair. */}
              <span className={styles.seatName}>{reveal.name || `Seat ${reveal.seat + 1}`}</span>
            </motion.div>
          );
        })}
      </div>

      {latest?.rank === 'A' && hakemSeat >= 0 && (
        <div className={styles.result}>
          {hakemSeat === mySeat ? 'You are' : `${playerNames[hakemSeat] ?? 'They'} is`} the Hâkem
        </div>
      )}

      {/* Partners sit opposite each other, so when the Aces pick two people who
          were sitting side by side, somebody changes chairs. Two players' whole
          view of the table rotates at that moment — saying so is the difference
          between a ceremony and a glitch. */}
      {swapped && (
        <div className={styles.swap}>
          {playerNames[swappedSeatA] ?? `Seat ${swappedSeatA + 1}`} and{' '}
          {playerNames[swappedSeatB] ?? `Seat ${swappedSeatB + 1}`} swap seats
        </div>
      )}
    </div>
  );
}
