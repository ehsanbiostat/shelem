import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import type { Seat as SeatIndex } from '@shelem/shared';
import styles from './DealingOverlay.module.css';
import { Card } from './Card.js';
import { useTableMetrics } from '../tableMetrics.js';
import { screenSlotFor } from '../screenSlot.js';
import { widowSpot } from '../widowSpot.js';
import { dealBlockSound } from '../sound.js';

/** Seconds between consecutive cards within one block. Small enough that a block
 * reads as one continuous stream rather than twelve separate events. */
const CARD_STAGGER = 0.018;
/** Pause between blocks — the beat that makes the twelve-card grouping legible. */
const BLOCK_GAP = 0.11;
/** How long a single card takes to travel from the deck to its seat. */
const FLIGHT = 0.4;

/** One run of cards from the deck to a single destination. `'widow'` is the four
 * cards Shelem sets aside; a seat index is a hand. */
export interface DealBlock {
  target: SeatIndex | 'widow';
  count: number;
}

export interface DealingOverlayProps {
  mySeat: SeatIndex;
  dealerSeat: SeatIndex;
  /** What the deal actually looks like, in order. Given by the game rather than
   * assumed here, because the shape of a deal is a rule: Shelem sends twelve at a
   * time to make long suits, Hokm sends the ordinary 5-4-4 packets. */
  blocks: DealBlock[];
  onDone: () => void;
}

interface FlyingCard {
  key: string;
  delay: number;
  dx: number;
  dy: number;
  rotate: number;
}

/** The deal, animated to match whatever rule the game actually deals by — the
 * blocks come in as a prop, because the shape of a deal differs between games and
 * is a rule in its own right (Shelem's twelve-card blocks are what let the light
 * shuffle carry long suits into a hand; see docs/game-rules.md).
 *
 * The block *order* need not be the engine's. Shelem's `deal()` sets the widow
 * aside fourth, before the dealer's own twelve; the plan passed in plays it last,
 * so the four cards are the final thing to land and stay on the table in front of
 * the dealer for the whole auction (see WidowPile). Which cards end up where is
 * unaffected — that's settled server-side before any of this runs — so the
 * divergence is purely in what the animation depicts.
 *
 * Every card animates `transform` and `opacity` only, which are the two
 * properties the compositor can handle without layout or paint. The cards are
 * staggered, so although all 52 are mounted at once, only a handful are ever
 * moving in the same frame — and a card that hasn't started yet is sitting at
 * opacity 0, costing nothing to composite. */
export function DealingOverlay({ mySeat, dealerSeat, blocks, onDone }: DealingOverlayProps) {
  const metrics = useTableMetrics();
  const { width, height, u } = metrics;

  const { cards, totalMs, blockStarts } = useMemo(() => {
    // Where each block lands, as an offset from the middle of the felt. Seats sit
    // just inside their own edge; the widow lands in front of the dealer, on the
    // exact spot WidowPile then mounts on — hence the shared helper, so the pile
    // doesn't visibly jump as one hands over to the other.
    function destination(target: SeatIndex | 'widow'): { dx: number; dy: number; rotate: number } {
      if (target === 'widow') {
        const spot = widowSpot(dealerSeat, mySeat, metrics);
        return { dx: spot.x, dy: spot.y, rotate: spot.rotate };
      }
      const slot = screenSlotFor(target, mySeat);
      const outX = width / 2 - u * 7;
      const outY = height / 2 - u * 7;
      if (slot === 'top') return { dx: 0, dy: -outY, rotate: 180 };
      if (slot === 'bottom') return { dx: 0, dy: outY, rotate: 0 };
      if (slot === 'left') return { dx: -outX, dy: 0, rotate: -90 };
      return { dx: outX, dy: 0, rotate: 90 };
    }

    const out: FlyingCard[] = [];
    const starts: number[] = [];
    let t = 0;
    for (const block of blocks) {
      starts.push(t);
      const { dx, dy, rotate } = destination(block.target);
      for (let i = 0; i < block.count; i++) {
        // A little scatter so the block lands as a rough pile, not a stack of
        // perfectly aligned tiles.
        const jitter = ((i % 3) - 1) * u * 0.6;
        out.push({
          key: `${String(block.target)}-${i}`,
          delay: t,
          dx: dx + jitter,
          dy: dy + jitter * 0.5,
          rotate: rotate + ((i % 5) - 2) * 1.5,
        });
        t += CARD_STAGGER;
      }
      t += BLOCK_GAP;
    }
    return { cards: out, totalMs: (t + FLIGHT) * 1000, blockStarts: starts };
  }, [mySeat, dealerSeat, blocks, metrics, width, height, u]);

  // One slide per block rather than per card: 52 sounds in under two seconds is
  // noise, five is a rhythm.
  useEffect(() => {
    const timers = [
      ...blockStarts.map((s) => window.setTimeout(dealBlockSound, s * 1000)),
      window.setTimeout(onDone, totalMs),
    ];
    return () => timers.forEach(clearTimeout);
  }, [blockStarts, totalMs, onDone]);

  return (
    <div className={styles.overlay} aria-hidden="true">
      <div className={styles.deck}>
        {cards.map((c) => (
          <motion.div
            key={c.key}
            className={styles.flyer}
            initial={{ x: 0, y: 0, rotate: 0, opacity: 0, scale: 0.92 }}
            animate={{ x: c.dx, y: c.dy, rotate: c.rotate, opacity: [0, 1, 1, 0], scale: 1 }}
            transition={{
              duration: FLIGHT,
              delay: c.delay,
              ease: 'easeOut',
              // The card fades in as it leaves the deck and out as it merges into
              // the pile it's joining, so it never visibly pops out of existence.
              opacity: { duration: FLIGHT, delay: c.delay, times: [0, 0.18, 0.72, 1] },
            }}
          >
            <Card card={{ suit: 'spades', rank: '2' }} size="sm" faceDown />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
