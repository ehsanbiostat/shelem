import type { Card, Seat, Suit } from './types.js';
import { isHigherRank } from './deck.js';

export interface TrickCardPlay {
  seat: Seat;
  card: Card;
}

/**
 * Determines the winner of a completed trick. If any trump cards were played, the
 * highest trump wins; otherwise the highest card of the led suit wins.
 */
export function determineTrickWinner(plays: TrickCardPlay[], trumpSuit: Suit): Seat {
  if (plays.length === 0) {
    throw new Error('Cannot determine winner of an empty trick');
  }

  const leadSuit = plays[0].card.suit;
  const trumpPlays = plays.filter((p) => p.card.suit === trumpSuit);
  const contenders = trumpPlays.length > 0 ? trumpPlays : plays.filter((p) => p.card.suit === leadSuit);

  let winner = contenders[0];
  for (const play of contenders.slice(1)) {
    if (isHigherRank(play.card.rank, winner.card.rank)) {
      winner = play;
    }
  }
  return winner.seat;
}

/**
 * Which cards in `hand` are legal to play, given the suit led this trick (null if
 * this player is leading). Must follow suit if able; if void in the led suit, any
 * card is legal — trump included, but not mandatory.
 */
export function legalCards(hand: Card[], leadSuit: Suit | null, _trumpSuit: Suit): Card[] {
  if (leadSuit === null) return hand.slice();

  const followSuit = hand.filter((c) => c.suit === leadSuit);
  if (followSuit.length > 0) return followSuit;

  return hand.slice();
}
