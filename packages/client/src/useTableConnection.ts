import { useCallback, useEffect, useRef, useState } from 'react';
import type { Room } from 'colyseus.js';
import type { Card as CardModel } from '@shelem/shared';
import { colyseusClient } from './colyseusClient';
import type { BaseStateJSON } from './roomState';

/** Colyseus keeps a seat reserved for 24h after a drop (see BaseTableRoom.onLeave)
 * so a mid-match refresh doesn't have to mean losing your spot — but only if the
 * client actually asks to reconnect with this token instead of joining fresh.
 * Without it, a refresh just opens a brand new join attempt against a room that's
 * still locked (full), which is rejected outright. Cleared only when a reconnect
 * attempt itself comes back invalid (expired/room gone) — never on a plain
 * onLeave, since that also fires for the disconnect a refresh causes on its way
 * out, which is exactly the case this needs to survive.
 *
 * Not namespaced per game: a browser is at one table at a time, whichever game it
 * is, and the room itself says which. */
const RECONNECT_STORAGE_KEY = 'pasoor:reconnectionToken';

/** The display name last used, so someone who plays every week doesn't retype it
 * every week. Purely a convenience — the server takes whatever is sent. */
const NAME_STORAGE_KEY = 'pasoor:name';

export interface TableConnection {
  name: string;
  setName: (name: string) => void;
  room: Room | null;
  state: BaseStateJSON | null;
  hand: CardModel[];
  /** Game-specific one-off messages, delivered to whichever board is mounted. */
  onMessage: (type: string, handler: (payload: unknown) => void) => void;
  error: string | null;
  setError: (error: string | null) => void;
  reconnecting: boolean;
  createTable: (game: string, config: unknown) => Promise<Room | null>;
  joinTable: (code: string) => Promise<Room | null>;
  leaveTable: () => void;
}

/**
 * Owns the socket for the whole app: one table at a time, held above the router so
 * navigating between screens never drops it.
 *
 * Deliberately game-agnostic. It knows how to get into and out of a room and how to
 * hold the state and hand that come back; what any of it *means* is the board's
 * business, which is what lets one connection serve both games.
 */
export function useTableConnection(): TableConnection {
  const [name, setNameState] = useState(() => localStorage.getItem(NAME_STORAGE_KEY) ?? '');
  const [room, setRoom] = useState<Room | null>(null);
  const [state, setState] = useState<BaseStateJSON | null>(null);
  const [hand, setHand] = useState<CardModel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(() => !!localStorage.getItem(RECONNECT_STORAGE_KEY));

  // Handlers the mounted board registered. Kept in a ref so re-registering doesn't
  // re-attach anything on the room itself.
  const handlers = useRef(new Map<string, (payload: unknown) => void>());

  const setName = useCallback((next: string) => {
    setNameState(next);
    localStorage.setItem(NAME_STORAGE_KEY, next);
  }, []);

  const onMessage = useCallback((type: string, handler: (payload: unknown) => void) => {
    handlers.current.set(type, handler);
  }, []);

  const attachRoom = useCallback((joined: Room) => {
    setRoom(joined);
    setError(null);
    localStorage.setItem(RECONNECT_STORAGE_KEY, joined.reconnectionToken);
    joined.onStateChange((s: unknown) => setState((s as { toJSON: () => BaseStateJSON }).toJSON()));
    joined.onMessage('hand', (cards: CardModel[]) => setHand(cards));
    joined.onMessage('actionRejected', (payload: { reason?: string }) =>
      setError(payload?.reason ?? 'Action rejected'),
    );
    // Anything else a game sends is forwarded to whichever board is mounted.
    joined.onMessage('*', (type: string | number, payload: unknown) => {
      handlers.current.get(String(type))?.(payload);
    });
    return joined;
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(RECONNECT_STORAGE_KEY);
    if (!token) return;
    colyseusClient
      .reconnect(token)
      .then((joined) => attachRoom(joined))
      .catch(() => localStorage.removeItem(RECONNECT_STORAGE_KEY))
      .finally(() => setReconnecting(false));
  }, [attachRoom]);

  const createTable = useCallback(
    async (game: string, config: unknown) => {
      try {
        return attachRoom(await colyseusClient.create(game, { name, config }));
      } catch (err) {
        setError(String(err));
        return null;
      }
    },
    [attachRoom, name],
  );

  const joinTable = useCallback(
    async (code: string) => {
      try {
        // Codes are generated uppercase (see BaseTableRoom); accept them typed either way.
        return attachRoom(await colyseusClient.joinById(code.trim().toUpperCase(), { name }));
      } catch (err) {
        setError(String(err));
        return null;
      }
    },
    [attachRoom, name],
  );

  /** A consented leave — the seat isn't coming back for this room (unlike a
   * dropped connection, which the reconnect flow above is for), so there's no
   * reason to hold onto the reconnection token or any in-room state. */
  const leaveTable = useCallback(() => {
    room?.leave();
    localStorage.removeItem(RECONNECT_STORAGE_KEY);
    handlers.current.clear();
    setRoom(null);
    setState(null);
    setHand([]);
    setError(null);
  }, [room]);

  return {
    name,
    setName,
    room,
    state,
    hand,
    onMessage,
    error,
    setError,
    reconnecting,
    createTable,
    joinTable,
    leaveTable,
  };
}
