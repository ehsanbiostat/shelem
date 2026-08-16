import type { CommonPhase } from '../core/types.js';

/**
 * The common phases plus the two Hokm adds, both of which sit before a card is
 * ever played:
 *
 * - `hakemDraw` — cards going face-up around the table until an Ace finds the Hâkem.
 * - `declaringTrump` — everyone holds five cards and the Hâkem is choosing trump.
 */
export type HokmPhase = CommonPhase | 'hakemDraw' | 'declaringTrump';

/**
 * How a hand finished.
 *
 * - `normal` — a team reached seven tricks with the other side on at least one.
 * - `kot` (کت) — the Hâkem's team took the first seven, opponents none.
 * - `hakemKoti` (حاکم کتی) — the opponents did that to the Hâkem, which is the
 *   more embarrassing way to lose and traditionally costs more.
 */
export type HandOutcome = 'normal' | 'kot' | 'hakemKoti';
