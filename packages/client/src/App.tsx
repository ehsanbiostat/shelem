import { useState } from 'react';
import type { Room } from 'colyseus.js';
import type { Card } from '@shelem/shared';
import { colyseusClient } from './colyseusClient';

/**
 * Bare-bones connectivity scaffold — NOT the final visual design (that's still
 * undecided, see docs/product-scope.md). This just proves a table can be created,
 * joined, and that game state + private hand sync end-to-end through Colyseus.
 */
export default function App() {
  const [name, setName] = useState('');
  const [roomIdInput, setRoomIdInput] = useState('');
  const [room, setRoom] = useState<Room | null>(null);
  const [state, setState] = useState<unknown>(null);
  const [hand, setHand] = useState<Card[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function createTable() {
    try {
      const joined = await colyseusClient.create('shelem', { name });
      attachRoom(joined);
    } catch (err) {
      setError(String(err));
    }
  }

  async function joinTable() {
    try {
      const joined = await colyseusClient.joinById(roomIdInput.trim(), { name });
      attachRoom(joined);
    } catch (err) {
      setError(String(err));
    }
  }

  function attachRoom(joined: Room) {
    setRoom(joined);
    setError(null);
    joined.onStateChange((s) => setState(s.toJSON ? s.toJSON() : s));
    joined.onMessage('hand', (cards: Card[]) => setHand(cards));
    joined.onMessage('actionRejected', (payload) => setError(JSON.stringify(payload)));
  }

  if (!room) {
    return (
      <div style={{ fontFamily: 'sans-serif', padding: 24, maxWidth: 480 }}>
        <h1>Shelem</h1>
        <p>Connectivity scaffold — table creation and joining.</p>
        <label>
          Display name
          <input value={name} onChange={(e) => setName(e.target.value)} style={{ display: 'block', marginBottom: 12 }} />
        </label>
        <button onClick={createTable} disabled={!name}>
          Create table
        </button>
        <div style={{ marginTop: 16 }}>
          <label>
            Table code
            <input
              value={roomIdInput}
              onChange={(e) => setRoomIdInput(e.target.value)}
              style={{ display: 'block', marginBottom: 12 }}
            />
          </label>
          <button onClick={joinTable} disabled={!name || !roomIdInput}>
            Join table
          </button>
        </div>
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 24 }}>
      <h1>Shelem — Table {room.roomId}</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <h2>Your hand</h2>
      <p>{hand.map((c) => `${c.rank}${c.suit[0].toUpperCase()}`).join(' ')}</p>
      <h2>Game state</h2>
      <pre style={{ background: '#f4f4f4', padding: 12, overflowX: 'auto' }}>
        {JSON.stringify(state, null, 2)}
      </pre>
    </div>
  );
}
