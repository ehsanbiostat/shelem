/**
 * The turn clock, shared by both games because it is a property of the table
 * rather than of the rules being played on it.
 */

/** Seconds a player gets to act. Thirty is poker's "forces a decision" setting and
 * comfortably longer than any card play needs; the reference platform this project
 * follows offers 7/15/30/60 for card play. On by default, because a clock nobody
 * switches on does not solve the problem it exists for — a disconnected player
 * freezing a table. */
export const DEFAULT_TURN_LIMIT_SECONDS = 30;

/** Turns the clock off entirely, restoring the behaviour the platform had before
 * it existed: the table waits, indefinitely. */
export const TURN_LIMIT_OFF = 0;

/** Below about five seconds a clock stops being a limit and becomes a reflex test,
 * and the ceiling only stops a typo producing a table that never moves on. */
export const MIN_TURN_LIMIT_SECONDS = 5;
export const MAX_TURN_LIMIT_SECONDS = 120;

/** Offered on the create-table screen. Shortcuts only — any whole number in range
 * is accepted, the same way the match-length presets work. */
export const TURN_LIMIT_PRESETS = [
  { label: 'Off', seconds: TURN_LIMIT_OFF },
  { label: '15s', seconds: 15 },
  { label: '30s', seconds: 30 },
  { label: '60s', seconds: 60 },
] as const;

/**
 * Decisions that deserve longer than following suit.
 *
 * Choosing a bid, naming trump off five cards, or picking four cards to bury are
 * genuine judgements; playing a card usually isn't. The reference platform makes
 * the same distinction, allowing more time for bidding than for the rest of a
 * hand.
 */
export const DELIBERATE_TURN_MULTIPLIER = 2;

/**
 * The client spends roughly this long animating a deal before the first player can
 * act on it. Added to the first decision of a hand so the clock isn't already
 * running through an animation nobody can play over.
 */
export const DEAL_ALLOWANCE_MS = 2500;

/**
 * Slack between the clock the player is shown and the one the server enforces.
 *
 * A player who acts on the last tick still has to get their message across the
 * network, and punishing them for their own latency is the quickest way to make a
 * fair clock feel unfair. The server waits this much longer than the countdown the
 * client drew.
 */
export const TURN_GRACE_MS = 750;

/**
 * How far out the audible countdown starts.
 *
 * Note this equals `MIN_TURN_LIMIT_SECONDS`, so a table set to the shortest limit
 * ticks for the whole turn. That is correct rather than a bug — at five seconds
 * the entire turn *is* the last five seconds — but it is deliberate, not an
 * accident of two constants happening to match.
 */
export const COUNTDOWN_TICK_SECONDS = 5;

/**
 * Which second of the audible countdown we are on: 5 down to 1, or null when it
 * shouldn't be sounding at all.
 *
 * Ceiling rather than floor, so the value is "seconds remaining" as a person would
 * say it — 4200ms left is "5", and the last whole second before zero is "1".
 * Nothing sounds at zero: by then the turn has been played and a tick would be
 * announcing something that already happened.
 *
 * Pure and separate from the sound itself because this is where the mistakes live
 * — the caller polls it roughly sixty times a second, so a boundary that lands on
 * the wrong side means a second ticked twice or skipped entirely.
 */
export function countdownTickSecond(remainingMs: number): number | null {
  if (remainingMs <= 0) return null;
  const second = Math.ceil(remainingMs / 1000);
  return second <= COUNTDOWN_TICK_SECONDS ? second : null;
}

/** Returns an error message when the limit is unusable, or null when it's fine. */
export function validateTurnLimit(seconds: unknown): string | null {
  if (typeof seconds !== 'number' || !Number.isInteger(seconds)) {
    return 'Turn limit must be a whole number of seconds';
  }
  if (seconds === TURN_LIMIT_OFF) return null;
  if (seconds < MIN_TURN_LIMIT_SECONDS || seconds > MAX_TURN_LIMIT_SECONDS) {
    return `Turn limit must be 0 (off), or between ${MIN_TURN_LIMIT_SECONDS} and ${MAX_TURN_LIMIT_SECONDS} seconds`;
  }
  return null;
}

/** How long this turn gets, in ms. `deliberate` marks the decisions worth more
 * time; `firstOfHand` adds the deal animation the player cannot act through. */
export function turnDurationMs(
  limitSeconds: number,
  options: { deliberate?: boolean; firstOfHand?: boolean } = {},
): number {
  if (limitSeconds === TURN_LIMIT_OFF) return 0;
  const base = limitSeconds * 1000 * (options.deliberate ? DELIBERATE_TURN_MULTIPLIER : 1);
  return base + (options.firstOfHand ? DEAL_ALLOWANCE_MS : 0);
}
