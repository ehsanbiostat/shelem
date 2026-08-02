import { useState } from 'react';
import type { Room } from 'colyseus.js';
import type { Bid, Card as CardModel, Seat as SeatIndex } from '@shelem/shared';
import { legalCards } from '@shelem/shared';
import styles from './App.module.css';
import { colyseusClient } from './colyseusClient';
import { seatOf, toCard, winningBidFrom, type GameStateJSON } from './roomState';
import { Table } from './components/Table.js';
import { TrickArea } from './components/TrickArea.js';
import { ScoreBar } from './components/ScoreBar.js';
import { BiddingPanel } from './components/BiddingPanel.js';
import { WidowDiscard } from './components/WidowDiscard.js';
import { Hand } from './components/Hand.js';

export default function App() {
  const [name, setName] = useState('');
  const [roomIdInput, setRoomIdInput] = useState('');
  const [room, setRoom] = useState<Room | null>(null);
  const [state, setState] = useState<GameStateJSON | null>(null);
  const [hand, setHand] = useState<CardModel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<CardModel | null>(null);

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
    joined.onStateChange((s: unknown) => setState((s as { toJSON: () => GameStateJSON }).toJSON()));
    joined.onMessage('hand', (cards: CardModel[]) => setHand(cards));
    joined.onMessage('actionRejected', (payload: { reason?: string }) => setError(payload?.reason ?? 'Action rejected'));
  }

  if (!room || !state) {
    return (
      <div className={styles.lobby}>
        <div className={styles.lobbyCard}>
          <h1 className={styles.wordmark}>Shelem</h1>
          <p className={styles.tagline}>A four-player Persian trick-taking card game</p>

          <label className={styles.field}>
            Display name
            <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} />
          </label>

          <button className={styles.primaryBtn} onClick={createTable} disabled={!name}>
            Create a table
          </button>

          <div className={styles.divider}>— or join with a table code —</div>

          <label className={styles.field}>
            Table code
            <input className={styles.input} value={roomIdInput} onChange={(e) => setRoomIdInput(e.target.value)} />
          </label>
          <button className={styles.secondaryBtn} onClick={joinTable} disabled={!name || !roomIdInput}>
            Join table
          </button>

          {error && <p className={styles.error}>{error}</p>}
        </div>
      </div>
    );
  }

  const mySeat = seatOf(room.sessionId, state.players);
  const playerNames: Record<number, string> = {};
  state.players.forEach((p) => (playerNames[p.seat] = p.name || `Seat ${p.seat + 1}`));

  if (mySeat === null) {
    return <div className={styles.lobbyWaiting}>Connecting…</div>;
  }

  const tablePlayers = state.players
    .filter((p) => p.sessionId !== '')
    .map((p) => ({ seat: p.seat as SeatIndex, name: p.name, connected: p.connected, handSize: p.handSize }));

  function sendBid(bid: Bid) {
    if (bid.type === 'numeric') room?.send('bid', { bidType: 'numeric', amount: bid.amount });
    else room?.send('bid', { bidType: bid.type });
  }

  function playCard(card: CardModel) {
    setSelectedCard(card);
    room?.send('playCard', { suit: card.suit, rank: card.rank });
  }

  function discardWidow(cards: CardModel[]) {
    room?.send('discardWidow', { cards });
  }

  const winningBid = winningBidFrom(state);
  const trumpSuit = state.trumpSuit ? (state.trumpSuit as CardModel['suit']) : null;
  const currentTrickPlays = state.currentTrick.map((p) => ({ seat: p.seat as SeatIndex, card: toCard(p) }));
  const leadSuit = currentTrickPlays.length > 0 ? currentTrickPlays[0].card.suit : null;
  const isMyTurn = state.currentTurnSeat === mySeat;
  const legal = trumpSuit && leadSuit ? legalCards(hand, leadSuit, trumpSuit) : hand;

  const pendingSwapForMe =
    state.pendingSeatSwap && state.pendingSeatSwap.toSeat === mySeat ? state.pendingSeatSwap : null;

  return (
    <div className={styles.gameShell}>
      <div className={styles.header}>
        <strong>Shelem</strong>
        <span className={styles.roomCode}>Table code: {room.roomId}</span>
      </div>

      {state.phase !== 'lobby' && (
        <ScoreBar
          team0Score={state.team0Score}
          team1Score={state.team1Score}
          matchTargetScore={state.matchTargetScore}
          handNumber={state.handNumber}
        />
      )}

      {state.phase === 'matchComplete' && (
        <div className={styles.matchComplete}>
          {state.team0Score >= state.matchTargetScore ? 'Team A wins the match!' : 'Team B wins the match!'}
        </div>
      )}

      {(state.phase === 'widow' || state.phase === 'playing') &&
        winningBid &&
        (() => {
          const label =
            winningBid.type === 'numeric' ? String(winningBid.amount) : winningBid.type === 'shelem' ? 'Shelem' : 'Sar-Shelem';
          return (
            <div className={styles.lobbyWaiting}>
              {playerNames[state.declarerSeat]}'s team bid {label}
            </div>
          );
        })()}

      <Table
        mySeat={mySeat}
        players={tablePlayers}
        dealerSeat={state.dealerSeat as SeatIndex}
        currentTurnSeat={state.currentTurnSeat as SeatIndex}
        declarerSeat={state.declarerSeat as SeatIndex | -1}
        center={
          state.phase === 'lobby' ? (
            <div className={styles.lobbyWaiting}>
              <div className={styles.big}>Waiting for players…</div>
              <div>{tablePlayers.length} / 4 seated</div>
            </div>
          ) : (
            <TrickArea mySeat={mySeat} plays={currentTrickPlays} trumpSuit={trumpSuit} />
          )
        }
      />

      {state.phase === 'lobby' && (
        <div className={styles.swapRequest}>
          {pendingSwapForMe ? (
            <>
              {playerNames[pendingSwapForMe.fromSeat]} wants to swap seats with you.
              <button onClick={() => room?.send('respondSeatSwap', { accept: true })}>Accept</button>
              <button onClick={() => room?.send('respondSeatSwap', { accept: false })}>Decline</button>
            </>
          ) : (
            tablePlayers
              .filter((p) => p.seat !== mySeat)
              .map((p) => (
                <button key={p.seat} onClick={() => room?.send('requestSeatSwap', { toSeat: p.seat })}>
                  Request swap with {p.name}
                </button>
              ))
          )}
        </div>
      )}

      {state.phase === 'bidding' && (
        <BiddingPanel
          bidHistory={state.bidHistory.map((b) => ({ seat: b.seat as SeatIndex, bidType: b.bidType, amount: b.amount }))}
          mySeat={mySeat}
          currentTurnSeat={state.currentTurnSeat as SeatIndex}
          playerNames={playerNames}
          onBid={sendBid}
        />
      )}

      {state.phase === 'widow' && state.declarerSeat === mySeat && (
        <WidowDiscard cards={hand} onDiscard={discardWidow} />
      )}

      {error && <p className={styles.error}>{error}</p>}

      {hand.length > 0 && state.phase !== 'widow' && (
        <Hand
          cards={hand}
          legalCards={state.phase === 'playing' ? legal : []}
          isMyTurn={state.phase === 'playing' && isMyTurn}
          onPlay={playCard}
          selectedCard={selectedCard}
        />
      )}
    </div>
  );
}
