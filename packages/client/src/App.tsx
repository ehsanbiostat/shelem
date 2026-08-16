import { useEffect } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { shelem, hokm } from '@shelem/shared';
import styles from './App.module.css';
import { useTableConnection } from './useTableConnection';
import { Landing } from './screens/Landing';
import { gameById } from './games/registry';
import { ConfigureTable as ConfigureShelem } from './games/shelem/ConfigureTable';
import { ConfigureTable as ConfigureHokm } from './games/hokm/ConfigureTable';
import { ShelemGame } from './games/shelem/ShelemGame';
import { HokmGame } from './games/hokm/HokmGame';

/** The last rules this browser created a table with, so someone who plays the same
 * house rules every week doesn't re-enter them every week. Only a starting point for
 * the create screen — the table's actual rules are whatever the server accepted.
 * Per game, since the two have nothing in common but a target score. */
function loadStoredConfig<T>(key: string, validate: (input: unknown) => { ok: true; config: T } | { ok: false }, fallback: T): T {
  const stored = localStorage.getItem(key);
  if (!stored) return fallback;
  try {
    // Validated rather than trusted: this is old data from a possibly older version
    // of the game, and a config that no longer passes should quietly become the
    // default rather than pre-filling a form that can't be submitted.
    const parsed = validate(JSON.parse(stored));
    return parsed.ok ? parsed.config : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const conn = useTableConnection();
  const navigate = useNavigate();

  // A table is a URL, so it can be pasted to the other three players rather than
  // dictated as a code. Whenever a room is attached — created, joined, or picked
  // back up by the reconnect on load — the address bar follows it.
  const roomId = conn.room?.roomId;
  useEffect(() => {
    if (roomId) navigate(`/t/${roomId}`, { replace: true });
  }, [roomId, navigate]);

  if (conn.reconnecting) {
    return <div className={styles.lobbyWaiting}>Reconnecting…</div>;
  }

  async function createAndOpen(game: string, config: unknown, configKey: string) {
    const joined = await conn.createTable(game, config);
    if (joined) localStorage.setItem(configKey, JSON.stringify(config));
  }

  return (
    <MotionConfig reducedMotion="user">
      <Routes>
        <Route
          path="/"
          element={
            <Landing
              name={conn.name}
              onNameChange={conn.setName}
              onJoin={(code) => conn.joinTable(code)}
              error={conn.error}
            />
          }
        />

        <Route
          path="/shelem/new"
          element={
            <ConfigureShelem
              initial={loadStoredConfig(
                'shelem:tableConfig',
                shelem.validateTableConfig,
                shelem.DEFAULT_TABLE_CONFIG,
              )}
              title="New Shelem table"
              subtitle="These rules are fixed for the whole match, so settle them now."
              submitLabel="Create table"
              onSubmit={(config) => createAndOpen('shelem', config, 'shelem:tableConfig')}
              onCancel={() => navigate('/')}
            />
          }
        />

        <Route
          path="/hokm/new"
          element={
            <ConfigureHokm
              initial={loadStoredConfig('hokm:tableConfig', hokm.validateHokmConfig, hokm.DEFAULT_HOKM_CONFIG)}
              title="New Hokm table"
              subtitle="These rules are fixed for the whole match, so settle them now."
              submitLabel="Create table"
              onSubmit={(config) => createAndOpen('hokm', config, 'hokm:tableConfig')}
              onCancel={() => navigate('/')}
            />
          }
        />

        <Route path="/t/:code" element={<TableRoute conn={conn} />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </MotionConfig>
  );
}

/**
 * Whichever board the attached room calls for.
 *
 * The game comes from `room.name`, not from the URL: a table code is enough to join
 * with, and the server is the one that knows what is being played at it. That's what
 * lets a single join field on the landing page serve both games.
 */
function TableRoute({ conn }: { conn: ReturnType<typeof useTableConnection> }) {
  const navigate = useNavigate();

  function leave() {
    conn.leaveTable();
    navigate('/');
  }

  if (!conn.room || !conn.state) {
    // Reached by pasting a table URL into a fresh browser, where there is no
    // connection to show. Joining needs a display name, so it starts at the front.
    return <Navigate to="/" replace />;
  }

  const game = gameById(conn.room.name);
  if (!game) {
    return <div className={styles.lobbyWaiting}>Unknown game: {conn.room.name}</div>;
  }

  if (game.id === 'hokm') {
    return (
      <HokmGame
        room={conn.room}
        state={conn.state}
        rawHand={conn.hand}
        onLeave={leave}
        error={conn.error}
      />
    );
  }

  return (
    <ShelemGame
      room={conn.room}
      state={conn.state}
      rawHand={conn.hand}
      onMessage={conn.onMessage}
      onLeave={leave}
      error={conn.error}
    />
  );
}
