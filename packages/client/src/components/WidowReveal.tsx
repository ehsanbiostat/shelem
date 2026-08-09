import type { Card as CardModel } from '@shelem/shared';
import styles from './WidowReveal.module.css';
import { Card } from './Card.js';
import { Overlay } from './Overlay.js';

export interface WidowRevealProps {
  cards: CardModel[];
  onContinue: () => void;
}

/** Shown to a Sar-Shelem declarer, and only to them. Sar-Shelem is played without
 * the widow exchange: these four cards are buried as the declarer's discard
 * without them choosing, so this is the single moment they get to see what went
 * out — and the only reason it matters is that the points still count for their
 * team, so a buried ace is not a lost ace.
 *
 * Advanced by a button rather than a timer. A player who happened to look away
 * would otherwise miss the one thing they are shown all hand. */
export function WidowReveal({ cards, onContinue }: WidowRevealProps) {
  return (
    <Overlay title="Your widow" dismissible={false}>
      <p className={styles.blurb}>
        Sar-Shelem is played without the exchange. These four are buried as your discard — their points
        still count for your team.
      </p>
      <div className={styles.cards}>
        {cards.map((card) => (
          <Card key={`${card.suit}-${card.rank}`} card={card} size="md" />
        ))}
      </div>
      <button type="button" className={styles.continueBtn} onClick={onContinue}>
        Continue
      </button>
    </Overlay>
  );
}
