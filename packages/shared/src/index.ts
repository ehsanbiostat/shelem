/**
 * The platform's shared code, in three parts.
 *
 * `core` is everything true of any trick-taking game on the table — the card model,
 * the deck and its shuffles, follow-suit legality, trick resolution, hand-fan
 * geometry — and is re-exported flat, because every consumer wants it.
 *
 * Each game's own rules live behind a namespace so two games can both have a
 * `config`, a `deal` and a scoring function without either having to invent an
 * awkward name to stay out of the other's way. Import them as `shelem.deal(...)`,
 * `hokm.dealHokm(...)`, and so on.
 */
export * from './core/index.js';

export * as shelem from './shelem/index.js';
export * as hokm from './hokm/index.js';
