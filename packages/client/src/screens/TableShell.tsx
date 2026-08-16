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
  error,
  children,
}: TableShellProps) {
  const [muted, setMutedState] = useState(isMuted);

  const seated = state.players.filter((p) => p.sessionId !== '');
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
