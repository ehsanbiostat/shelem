/**
 * Table sound effects, synthesised with the Web Audio API rather than loaded from
 * audio files. These are three very short cues, and generating them costs a few
 * oscillators — versus shipping binary assets that need licence tracking, add to
 * the bundle, and can't be tuned without re-exporting them. It also means a cue
 * can be built from the same numbers the visuals use.
 *
 * A card landing on felt is mostly broadband noise with a fast decay, which is
 * exactly what a filtered noise burst gives you; the tonal cues (start chime) are
 * plain sine partials. Nothing here is longer than half a second.
 */

/** Browsers won't let audio start before a user gesture, so the context is
 * created on first use — by which point the player has clicked to join a table —
 * and resumed if the browser parked it. */
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

const MUTE_STORAGE_KEY = 'shelem:muted';

let muted = (() => {
  try {
    return localStorage.getItem(MUTE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
})();

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
  try {
    localStorage.setItem(MUTE_STORAGE_KEY, value ? '1' : '0');
  } catch {
    // Private browsing / storage disabled — the setting just won't persist.
  }
}

/** A short burst of white noise shaped by an exponential decay envelope and a
 * band-pass filter. This is the workhorse: card-on-felt and the trick sweep are
 * both the same gesture at different centre frequencies and lengths. */
function noiseBurst(
  now: number,
  { duration, frequency, q, gain, sweepTo }: { duration: number; frequency: number; q: number; gain: number; sweepTo?: number },
) {
  const context = audio();
  if (!context) return;

  const frameCount = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i++) samples[i] = Math.random() * 2 - 1;

  const source = context.createBufferSource();
  source.buffer = buffer;

  const filter = context.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(frequency, now);
  filter.Q.value = q;
  if (sweepTo !== undefined) filter.frequency.exponentialRampToValueAtTime(sweepTo, now + duration);

  const envelope = context.createGain();
  // A card doesn't ease in — it hits and decays, so the attack is near-instant
  // and everything expressive is in the tail.
  envelope.gain.setValueAtTime(0.0001, now);
  envelope.gain.exponentialRampToValueAtTime(gain, now + 0.004);
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  source.connect(filter).connect(envelope).connect(context.destination);
  source.start(now);
  source.stop(now + duration);
}

/** A single sine partial with a soft envelope — used for the tonal cues. */
function tone(now: number, { frequency, duration, gain, delay = 0 }: { frequency: number; duration: number; gain: number; delay?: number }) {
  const context = audio();
  if (!context) return;

  const at = now + delay;
  const osc = context.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(frequency, at);

  const envelope = context.createGain();
  envelope.gain.setValueAtTime(0.0001, at);
  envelope.gain.exponentialRampToValueAtTime(gain, at + 0.02);
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);

  osc.connect(envelope).connect(context.destination);
  osc.start(at);
  osc.stop(at + duration);
}

/** A card being set down on the felt: a soft, low, very short thud. Fires once per
 * card played, by anyone, so it has to stay unobtrusive — four of these land in
 * quick succession every trick. */
export function playCardSound() {
  if (muted) return;
  const context = audio();
  if (!context) return;
  const now = context.currentTime;
  noiseBurst(now, { duration: 0.075, frequency: 900, q: 0.9, gain: 0.14 });
  // A touch of low body underneath, so it reads as card-on-table rather than a
  // bare click.
  tone(now, { frequency: 160, duration: 0.06, gain: 0.05 });
}

/** A bid being placed: a knock on wood. Wood is a resonant body rather than a
 * flat surface, so this is the same noise burst as a card landing but with a much
 * narrower filter (high Q) around a low frequency — that resonance is what makes
 * it read as "hollow wood" instead of "click". Two knocks rather than one, since
 * a single one reads as a card being played, which is a different event. */
export function bidSound() {
  if (muted) return;
  const context = audio();
  if (!context) return;
  const now = context.currentTime;
  noiseBurst(now, { duration: 0.06, frequency: 420, q: 3.6, gain: 0.16 });
  tone(now, { frequency: 180, duration: 0.05, gain: 0.07 });
  noiseBurst(now + 0.11, { duration: 0.07, frequency: 370, q: 3.6, gain: 0.13 });
  tone(now + 0.11, { frequency: 160, duration: 0.06, gain: 0.06 });
}

/** The completed trick being swept off the table: longer, quieter, and sliding
 * downward in pitch so it reads as cards moving away rather than landing. */
export function trickClearedSound() {
  if (muted) return;
  const context = audio();
  if (!context) return;
  noiseBurst(context.currentTime, { duration: 0.28, frequency: 2200, q: 0.7, gain: 0.075, sweepTo: 500 });
}

/** The hand being dealt. Two rising notes — a perfect fifth (A4 → E5), which
 * resolves rather than hanging, so it reads as "we're under way" and not as a
 * notification. Deliberately the only cue with any melody to it. */
export function gameStartSound() {
  if (muted) return;
  const context = audio();
  if (!context) return;
  const now = context.currentTime;
  tone(now, { frequency: 440, duration: 0.18, gain: 0.11 });
  tone(now, { frequency: 659.25, duration: 0.32, gain: 0.09, delay: 0.11 });
}
