import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styles from '../App.module.css';
import { isMuted, setMuted } from '../sound';
import type { BaseStateJSON } from '../roomState';

export interface TableShellProps {
  state: BaseStateJSON;
  mySeat: number;
  roomCode: string;
  playerNames: Record<number, string>;
  onLeave: () => void;
  onSeatSwapRequest: (toSeat: number) => void;
  onSeatSwapResponse: (accept: boolean) => void;
  /** Only the host may seat bots, and only at a game that can play them. When
   * false the controls aren't drawn at all rather than drawn and refused. */
  canManageBots?: boolean;
  onAddBot?: (seat: number) => void;
  onRemoveBot?: (seat: number) => void;
  error: string | null;
  children: ReactNode;
}

/**
 * The frame around whichever board is being played: the header, the sound toggle,
 * the leave button, the seat-swap bar, and the error line.
 *
 * All of it is the table rather than the game — the same split BaseTableRoom makes
 * on the server — so both boards get it without either owning it.
 */
export function TableShell({
  state,
  mySeat,
  roomCode,
  playerNames,
  onLeave,
  onSeatSwapRequest,
  onSeatSwapResponse,
  canManageBots = false,
  onAddBot,
  onRemoveBot,
  error,
  children,
}: TableShellProps) {
  const [muted, setMutedState] = useState(isMuted);

  // People only: a bot is not somebody you ask to swap seats with.
  const seated = state.players.filter((p) => p.sessionId !== '');
  const emptySeats = state.players.filter((p) => p.sessionId === '' && !p.isBot);
  const botSeats = state.players.filter((p) => p.isBot);
  const pendingSwapForMe =
    state.pendingSeatSwap && state.pendingSeatSwap.toSeat === mySeat ? state.pendingSeatSwap : null;

  return (
    <div className={styles.gameShell}>
      <div className={styles.header}>
        <Link to="/" className={styles.wordmarkLink} onClick={onLeave}>
          Pasoor
        </Link>
        <div className={styles.headerRight}>
          <span className={styles.roomCode}>Table code: {roomCode}</span>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label={muted ? 'Unmute sound' : 'Mute sound'}
            title={muted ? 'Unmute sound' : 'Mute sound'}
            onClick={() => {
              const next = !muted;
              setMuted(next);
              setMutedState(next);
            }}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <button type="button" className={styles.leaveBtn} onClick={onLeave}>
            Leave table
          </button>
        </div>
      </div>

      {children}

      {/* Bots are how a table gets going without waiting for four people — and
          how one person practises alone. Host-only, and only while the table is
          still filling: once cards are out, a bot is holding a hand. */}
      {state.phase === 'lobby' && canManageBots && (emptySeats.length > 0 || botSeats.length > 0) && (
        <div className={styles.swapRequest}>
          {emptySeats.map((p) => (
            <button key={`add-${p.seat}`} onClick={() => onAddBot?.(p.seat)}>
              Add bot to seat {p.seat + 1}
            </button>
          ))}
          {botSeats.map((p) => (
            <button key={`remove-${p.seat}`} onClick={() => onRemoveBot?.(p.seat)}>
              Remove {p.name}
            </button>
          ))}
        </div>
      )}

      {state.phase === 'lobby' && (
        <div className={styles.swapRequest}>
          {pendingSwapForMe ? (
            <>
              {playerNames[pendingSwapForMe.fromSeat]} wants to swap seats with you.
              <button onClick={() => onSeatSwapResponse(true)}>Accept</button>
              <button onClick={() => onSeatSwapResponse(false)}>Decline</button>
            </>
          ) : (
            seated
              .filter((p) => p.seat !== mySeat)
              .map((p) => (
                <button key={p.seat} onClick={() => onSeatSwapRequest(p.seat)}>
                  Request swap with {p.name}
                </button>
              ))
          )}
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
