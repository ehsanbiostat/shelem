import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../App.module.css';
import tiles from './Landing.module.css';
import { GAMES } from '../games/registry';

export interface LandingProps {
  name: string;
  onNameChange: (name: string) => void;
  onJoin: (code: string) => void;
  error: string | null;
}

/**
 * The front door. One card, the same one a single-game lobby was, with the games
 * as tiles inside it.
 *
 * Two things about the shape here are deliberate. A tile goes straight to that
 * game's rules screen rather than to a per-game lobby, so it's still two steps to
 * a table exactly as it was with one game. And joining by code is one field for
 * both games, because a code already implies its game — `joinById` doesn't take a
 * game name, and the room tells the client which board to draw afterwards. Asking
 * someone to pick Shelem or Hokm before typing a code would be asking for
 * something the server already knows.
 */
export function Landing({ name, onNameChange, onJoin, error }: LandingProps) {
  const [code, setCode] = useState('');
  const navigate = useNavigate();
  const named = name.trim().length > 0;

  return (
    <div className={styles.lobby}>
      <div className={styles.lobbyCard}>
        <h1 className={styles.wordmark}>Pasoor</h1>
        <p className={styles.tagline}>Persian card games, online</p>

        <label className={styles.field}>
          Display name
          <input
            className={styles.input}
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Your name"
          />
        </label>

        <div className={tiles.grid}>
          {GAMES.map((game) => (
            <button
              key={game.id}
              type="button"
              className={tiles.tile}
              disabled={!named}
              onClick={() => navigate(game.path)}
            >
              <span className={tiles.glyphs} aria-hidden="true">
                {game.glyphs}
              </span>
              <span className={tiles.name}>{game.name}</span>
              <span className={tiles.blurb}>{game.blurb}</span>
              <span className={tiles.meta}>4 players · 2 v 2</span>
              <span className={tiles.action}>New table</span>
            </button>
          ))}
        </div>

        <div className={styles.divider}>— or join with a table code —</div>

        <label className={styles.field}>
          Table code
          <input
            className={`${styles.input} ${styles.codeInput}`}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={4}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            placeholder="ABCD"
          />
        </label>
        <button
          className={styles.secondaryBtn}
          onClick={() => onJoin(code)}
          disabled={!named || code.trim().length === 0}
        >
          Join table
        </button>

        {error && <p className={styles.error}>{error}</p>}
      </div>
    </div>
  );
}
