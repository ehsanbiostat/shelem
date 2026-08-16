import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { Card as CardModel, Seat as SeatIndex } from '@shelem/shared';
import styles from './WidowPile.module.css';
import { Card } from '../../components/Card.js';
import { useTableMetrics } from '../../tableMetrics.js';
import { widowSpot } from '../../widowSpot.js';
import { fanOffsets } from '../../fanGeometry.js';
import { dealBlockSound } from '../../sound.js';

/** How long the pile takes to cross the table to the winning bidder. Slower than
 * one card of the deal (0.4s) because it travels further and is the only thing
 * moving — this is a moment the table is meant to watch, not a card being flicked
 * onto a stack. */
const FLIGHT_S = 0.55;
/** Half of the flip: the pile squeezes to nothing, swaps to its faces, opens back up. */
const PINCH_S = 0.16;
/** How long the declarer gets to look at the four cards on the table before they
 * fade and the hand takes over. They see them again in their own fan straight
 * after — raised into view by Hand's widow showcase — so this is a glance, not a
 * reading. */
const REVEAL_HOLD_MS = 1000;
/** With no flip there is nothing to read, so the pile only has to sit long enough
 * to register as having landed. For Sar-Shelem the WidowReveal overlay opens over
 * the top of this anyway. */
const LANDED_HOLD_MS = 350;
/** Cards overlap rather than sitting apart: four `sm` cards (6.3u wide) at 2.6u
 * apart is ~14u end to end, which stays clear of a seat's own fan. */
const FAN_SPACING_U = 2.6;

/** Local sequence after the auction is decided. The pile is in exactly one of
 * these at a time, and only ever moves forwards. */
type Stage = 'parked' | 'flying' | 'pinched' | 'revealed' | 'gone';

export interface WidowPileProps {
  mySeat: SeatIndex;
  dealerSeat: SeatIndex;
  /** Set the moment the auction resolves — until then the pile sits by the dealer. */
  declarerSeat: SeatIndex | null;
  /** The four cards themselves. Only ever known to the declarer's own client, which
   * learns them as the 12→16 diff on its private hand message; everyone else passes
   * nothing and the pile stays face-down all the way. */
  faces?: CardModel[];
  /** False for a Sar-Shelem played without the widow exchange: those four cards are
   * buried unchosen and never join a hand, so WidowReveal is the reveal and there is
   * nothing to turn over here. */
  flip: boolean;
}

/**
 * The four widow cards, as an object on the table.
 *
 * They are dealt to a spot in front of the dealer (the last block of
 * DealingOverlay), sit there face-down for the whole auction — the one thing on
 * screen that says the widow exists at all — and then fly to whoever won the bid.
 *
 * Every client runs this off synced state alone (`dealerSeat`, `declarerSeat`), so
 * all four seats see the same flight at the same moment. The card *faces* are the
 * exception, and deliberately so: they arrive only on the declarer's own hand
 * message, so only their screen can turn the cards over.
 */
export function WidowPile({ mySeat, dealerSeat, declarerSeat, faces, flip }: WidowPileProps) {
  const metrics = useTableMetrics();
  const [stage, setStage] = useState<Stage>('parked');
  const [flipped, setFlipped] = useState(false);

  // Read at landing time, not when the flight starts. The declarer's faces arrive on
  // their private hand message, which is a separate delivery from the state patch
  // that resolves the auction — so `flip && faces` can turn true a beat after the
  // flight has begun. Through a ref because the alternative is putting it in the
  // effect's deps, where that late change would restart the whole sequence.
  const canFlipRef = useRef(false);
  canFlipRef.current = flip && faces?.length === 4;

  // The sequence hangs off the auction resolving, which is a synced state change
  // rather than anything this client did — so it runs on all four screens at once.
  useEffect(() => {
    if (declarerSeat === null) return;

    setStage('flying');
    dealBlockSound();

    const timers: number[] = [];
    timers.push(
      window.setTimeout(() => {
        if (!canFlipRef.current) {
          timers.push(window.setTimeout(() => setStage('gone'), LANDED_HOLD_MS));
          return;
        }
        setStage('pinched');
        timers.push(
          window.setTimeout(() => {
            setFlipped(true);
            setStage('revealed');
          }, PINCH_S * 1000),
        );
        timers.push(window.setTimeout(() => setStage('gone'), PINCH_S * 1000 + REVEAL_HOLD_MS));
      }, FLIGHT_S * 1000),
    );
    return () => timers.forEach(clearTimeout);
  }, [declarerSeat]);

  const spot = widowSpot(declarerSeat ?? dealerSeat, mySeat, metrics);
  const offsets = fanOffsets(4, FAN_SPACING_U * metrics.u);

  return (
    <motion.div
      className={styles.pile}
      aria-hidden="true"
      initial={{ x: spot.x, y: spot.y, rotate: spot.rotate, opacity: 0 }}
      animate={{
        x: spot.x,
        y: spot.y,
        rotate: spot.rotate,
        opacity: stage === 'gone' ? 0 : 1,
      }}
      // A redeal gathers the cards back up rather than making them vanish, so the
      // pile leaves the way it came — back to the deck in the middle, just as the
      // next deal starts throwing cards out of it.
      exit={{ x: 0, y: 0, rotate: 0, opacity: 0 }}
      transition={{
        x: { duration: FLIGHT_S, ease: 'easeOut' },
        y: { duration: FLIGHT_S, ease: 'easeOut' },
        rotate: { duration: FLIGHT_S, ease: 'easeOut' },
        opacity: { duration: stage === 'gone' ? 0.3 : 0.25 },
      }}
    >
      {offsets.map((offset, i) => (
        <motion.div
          key={i}
          className={styles.slot}
          // Position is the fan offset; only the pinch animates. Keeping the two on
          // separate properties means the flip can't drag a card out of the fan.
          style={{ x: offset, rotate: (i - 1.5) * 3 }}
          animate={{ scaleX: stage === 'pinched' ? 0 : 1 }}
          transition={{ duration: PINCH_S, ease: 'easeInOut' }}
        >
          {flipped && faces?.length === 4 ? (
            <Card card={faces[i]} size="sm" />
          ) : (
            // Face-down never reads `card`, so the model is a throwaway — the same
            // placeholder the dealing overlay and the seat fans use.
            <Card card={{ suit: 'spades', rank: '2' }} size="sm" faceDown />
          )}
        </motion.div>
      ))}
    </motion.div>
  );
}
