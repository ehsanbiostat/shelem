import { useEffect, useRef, useState } from 'react';
import type { Room } from 'colyseus.js';

/**
 * How much the browser's clock is ahead of or behind the server's, in ms.
 *
 * `turnEndsAt` is a *server* timestamp, and browser clocks are routinely wrong by
 * seconds — long enough to draw a countdown that is already finished, or one that
 * never ends. One round trip on join fixes it: the client sends its own time, the
 * server echoes it back with its own, and half the round trip is a good enough
 * estimate of the one-way delay.
 *
 * Re-measured occasionally because a laptop waking from sleep can shift its clock
 * mid-match.
 */
export function useServerClockOffset(room: Room | null): number {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!room) return;

    const handler = (payload: { t0: number; serverTime: number }) => {
      const now = Date.now();
      const roundTrip = now - payload.t0;
      // The server stamped its time roughly half a round trip ago.
      setOffset(payload.serverTime + roundTrip / 2 - now);
    };
    room.onMessage('timeSync', handler);

    const probe = () => room.send('timeSync', { t0: Date.now() });
    probe();
    const timer = window.setInterval(probe, 60_000);
    return () => window.clearInterval(timer);
  }, [room]);

  return offset;
}

export interface TurnCountdown {
  /** 1 at the start of the turn, 0 when it expires. -1 when no clock is running,
   * which is different from 0 — nothing to draw rather than nothing left. */
  fraction: number;
  remainingMs: number;
  running: boolean;
}

/**
 * The live countdown, recomputed every frame.
 *
 * Driven by `requestAnimationFrame` rather than `setInterval`, which matters for
 * two reasons: the ring drains smoothly instead of stepping, and the browser stops
 * calling it entirely on a hidden tab, so a backgrounded game costs nothing.
 *
 * Nothing here talks to the server. The deadline arrives once as part of ordinary
 * state, and every frame after that is local arithmetic — syncing a ticking number
 * instead would mean a patch a second to every client at every table, for
 * information they can work out themselves.
 */
export function useTurnCountdown(turnEndsAt: number, turnLimitMs: number, serverOffset: number): TurnCountdown {
  const [now, setNow] = useState(() => Date.now());
  const frame = useRef<number>(0);

  const running = turnEndsAt > 0 && turnLimitMs > 0;

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      setNow(Date.now());
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [running, turnEndsAt]);

  if (!running) return { fraction: -1, remainingMs: 0, running: false };

  const remainingMs = Math.max(0, turnEndsAt - (now + serverOffset));
  return {
    fraction: Math.max(0, Math.min(1, remainingMs / turnLimitMs)),
    remainingMs,
    running: true,
  };
}
