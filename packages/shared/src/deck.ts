import type { Card, Rank, Suit } from './types.js';

export const SUITS: readonly Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

/** Low to high. */
export const RANKS: readonly Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

/** Fisher-Yates shuffle. Accepts an injectable RNG (defaults to Math.random) so tests can be deterministic. */
export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export interface Deal {
  /** Index 0-3, one 12-card hand per seat. */
  hands: [Card[], Card[], Card[], Card[]];
  /** The 4-card widow. */
  widow: Card[];
}

/**
 * Deals a shuffled 52-card deck: 12 cards to each of 4 seats (in 3 batches of 4),
 * with the remaining 4 cards forming the widow.
 */
export function deal(shuffledDeck: Card[]): Deal {
  if (shuffledDeck.length !== 52) {
    throw new Error(`deal() requires a 52-card deck, got ${shuffledDeck.length}`);
  }

  const hands: [Card[], Card[], Card[], Card[]] = [[], [], [], []];
  let cursor = 0;
  for (let round = 0; round < 3; round++) {
    for (let seat = 0; seat < 4; seat++) {
      hands[seat].push(...shuffledDeck.slice(cursor, cursor + 4));
      cursor += 4;
    }
  }
  const widow = shuffledDeck.slice(cursor, cursor + 4);

  return { hands, widow };
}

export function rankIndex(rank: Rank): number {
  return RANKS.indexOf(rank);
}

/** True if `a` outranks `b` (same suit assumed — caller decides suit relevance). */
export function isHigherRank(a: Rank, b: Rank): boolean {
  return rankIndex(a) > rankIndex(b);
}
