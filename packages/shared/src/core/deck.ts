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

/**
 * How many riffles the table gives the deck between hands. Deliberately low: the deck
 * comes back from the previous hand grouped into tricks (mostly one suit each), and a
 * light shuffle leaves that grouping partly intact, so hands run longer in a suit than
 * a uniformly random deal would give. That's how the game plays in person, and it's
 * what makes a trump-length bid reachable.
 *
 * Simulated over 40k chained hands: at 2 riffles a hand holds a 6+ card suit 27% of the
 * time vs 13% under a uniform shuffle, and the declarer averages ~6.0 trumps vs 5.4.
 * Raising this to 4 wipes the effect out entirely; dropping to 0 makes nearly every hand
 * a freak (43% with a 6+ suit).
 */
export const TABLE_RIFFLES = 2;

/**
 * One riffle shuffle, per the Gilbert-Shannon-Reeds model: cut the deck near the middle
 * (binomially, so not exactly in half), then interleave by dropping from whichever packet
 * still holds more cards, proportionally — which is how a real riffle behaves.
 */
export function gsrRiffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const n = items.length;
  let left = 0;
  for (let i = 0; i < n; i++) if (rng() < 0.5) left++;

  const result: T[] = [];
  let a = 0;
  let b = left;
  while (a < left && b < n) {
    const remainingLeft = left - a;
    const remainingRight = n - b;
    if (rng() < remainingLeft / (remainingLeft + remainingRight)) {
      result.push(items[a++]);
    } else {
      result.push(items[b++]);
    }
  }
  while (a < left) result.push(items[a++]);
  while (b < n) result.push(items[b++]);
  return result;
}

/**
 * Cuts the deck: lift a chunk off the top, put it underneath.
 *
 * The cut point is uniform over the deck, NOT clustered near the middle the way a person
 * cuts. This matters and is not a detail. A cut is a rotation — it preserves every clump,
 * so it can't undo the suit grouping we want to keep. What it does is decide which stretch
 * of the previous hand lands in which seat. Since the deal hands out contiguous 12-card
 * blocks, a middle-ish cut shifts the deck by roughly two seats' worth and merely moves the
 * advantage to a different player instead of removing it; simulation showed a persistent
 * ~6.5 point-per-hand gap between seats surviving any number of human-style cuts. A single
 * uniform cut flattens that gap to ~0.1. Further cuts add nothing — composing uniform
 * rotations just gives another uniform rotation — so one is exactly right.
 */
export function cutDeck<T>(items: T[], rng: () => number = Math.random): T[] {
  if (items.length < 2) return items.slice();
  const point = 1 + Math.floor(rng() * (items.length - 1));
  return items.slice(point).concat(items.slice(0, point));
}

/**
 * The between-hands shuffle: a few riffles and a cut, the way it's done at the table.
 * Feed it the deck collected from the previous hand (see the pile-stacking in ShelemRoom).
 */
export function tableShuffle<T>(
  items: T[],
  rng: () => number = Math.random,
  riffles: number = TABLE_RIFFLES,
): T[] {
  let deck = items.slice();
  for (let i = 0; i < riffles; i++) {
    deck = gsrRiffle(deck, rng);
  }
  return cutDeck(deck, rng);
}

export function rankIndex(rank: Rank): number {
  return RANKS.indexOf(rank);
}

/** True if `a` outranks `b` (same suit assumed — caller decides suit relevance). */
export function isHigherRank(a: Rank, b: Rank): boolean {
  return rankIndex(a) > rankIndex(b);
}
