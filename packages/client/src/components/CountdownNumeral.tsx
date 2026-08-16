import { AnimatePresence, motion } from 'framer-motion';
import styles from './CountdownNumeral.module.css';

export interface CountdownNumeralProps {
  /** The second being counted, 5 down to 1, or null when nothing should show. */
  second: number | null;
}

/**
 * The last five seconds of your own turn, counted out on the felt the way an old
 * film leader counts into a reel.
 *
 * Only the numeral is borrowed from that reference. A real leader centres its
 * number in a target of two circles with a sweep hand, and the Society leader adds
 * crosshairs to the edges — all of which was considered and dropped, because this
 * felt already carries a trick pile, four seats, two corner overlays and a hand
 * fan. What makes it read as film rather than as a digital clock is the heavy
 * numeral and the per-second punctuation, not the furniture around it.
 *
 * Each second is keyed by its own value, so AnimatePresence does the work: a
 * number arrives slightly oversized, settles, and fades as the next one replaces
 * it. That beat is the effect.
 *
 * Shown to the player on the clock and nobody else — the table can already see
 * whose turn it is from the seat ring, and a countdown you can do nothing about is
 * just noise.
 */
export function CountdownNumeral({ second }: CountdownNumeralProps) {
  return (
    <div className={styles.stage} aria-hidden="true">
      <AnimatePresence mode="popLayout">
        {second !== null && (
          <motion.div
            key={second}
            className={`${styles.numeral} ${second <= 2 ? styles.urgent : ''}`}
            initial={{ opacity: 0, scale: 1.35 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.82 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
          >
            {second}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
