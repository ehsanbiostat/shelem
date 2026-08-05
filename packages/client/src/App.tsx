import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Room } from 'colyseus.js';
import { MotionConfig, useReducedMotion } from 'framer-motion';
import type { Bid, Card as CardModel, Seat as SeatIndex, Team } from '@shelem/shared';
import { legalCards, teamForSeat } from '@shelem/shared';
import styles from './App.module.css';
import { colyseusClient } from './colyseusClient';
import { sortHand } from './cardSort';
import { seatOf, toCard, winningBidFrom, type GameStateJSON } from './roomState';
import { Table } from './components/Table.js';
import { TrickArea } from './components/TrickArea.js';
import { ScoreBar } from './components/ScoreBar.js';
import { BiddingPanel } from './components/BiddingPanel.js';
import { Hand } from './components/Hand.js';
import { LastTrickPanel } from './components/LastTrickPanel.js';
import { TableSettings } from './components/TableSettings.js';
import { bidSound, gameStartSound, isMuted, playCardSound, setMuted, shuffleSound, trickClearedSound } from './sound.js';

function cardsEqual(a: CardModel, b: CardModel): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

/** Colyseus keeps a seat reserved for 24h after a drop (see ShelemRoom.onLeave) so
 * a mid-match refresh doesn't have to mean losing your spot — but only if the
 * client actually asks to reconnect with this token instead of joining fresh.
 * Without it, a refresh just opens a brand new join attempt against a room that's
 * still locked (full), which is rejected outright. Cleared only when a reconnect
 * attempt itself comes back invalid (expired/room gone) — never on a plain
 * onLeave, since that also fires for the disconnect a refresh causes on its way
 * out, which is exactly the case this needs to survive. */
const RECONNECT_STORAGE_KEY = 'shelem:reconnectionToken';

export default function App() {
  const [name, setName] = useState('');
  const [roomIdInput, setRoomIdInput] = useState('');
  const [room, setRoom] = useState<Room | null>(null);
  const [reconnecting, setReconnecting] = useState(() => !!localStorage.getItem(RECONNECT_STORAGE_KEY));
  const [state, setState] = useState<GameStateJSON | null>(null);
  const [rawHand, setRawHand] = useState<CardModel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<CardModel | null>(null);
  const [widowSelection, setWidowSelection] = useState<CardModel[]>([]);
  // The 4 cards the widow pickup just added to the declarer's hand, computed as a
  // diff the moment the 16-card hand arrives — used to highlight them in place
  // rather than opening a separate picker for the discard.
  const widowAddedRef = useRef<CardModel[]>([]);
  const [muted, setMutedState] = useState(isMuted);
  const [dealing, setDealing] = useState<{ dealerSeat: SeatIndex } | null>(null);
  const reduceMotion = useReducedMotion();

  // Trump is unknown (and every suit-color-alternating order is equivalent) until the
  // declarer's opening lead sets it — re-sort whenever that changes, not just on deal.
  const trumpSuit: CardModel['suit'] | null = state?.trumpSuit ? (state.trumpSuit as CardModel['suit']) : null;
  const hand = useMemo(() => sortHand(rawHand, trumpSuit), [rawHand, trumpSuit]);

  useEffect(() => {
    if (state?.phase !== 'widow') setWidowSelection([]);
  }, [state?.phase]);

  // Sound is driven off transitions in the synced state rather than off the local
  // player's own actions, so every seat's play is heard, not just our own. The
  // trick length going up means a card just landed; going back to empty means the
  // completed trick was just swept away (see ShelemRoom's resolveTrick pause).
  const prevTrickCount = useRef(0);
  const trickCount = state?.currentTrick.length ?? 0;
  useEffect(() => {
    if (trickCount > prevTrickCount.current) playCardSound();
    else if (trickCount === 0 && prevTrickCount.current > 0) trickClearedSound();
    prevTrickCount.current = trickCount;
  }, [trickCount]);

  // Every bid anyone places, tracked the same way as the trick: off the synced
  // history growing, so all four seats' bids are heard rather than only our own.
  const prevBidCount = useRef(0);
  const bidCount = state?.bidHistory.length ?? 0;
  useEffect(() => {
    if (bidCount > prevBidCount.current) bidSound();
    prevBidCount.current = bidCount;
  }, [bidCount]);

  // Each new deal, including a redeal after three passes. The riffle plays as the
  // cards go out and the chime lands once they've arrived, so the two read as one
  // sequence rather than stacking on top of each other. Anyone who has asked their
  // system for less motion skips straight to the chime.
  const handNumber = state?.handNumber ?? 0;
  const dealerSeat = state?.dealerSeat ?? 0;
  useEffect(() => {
    if (handNumber <= 0) return;
    if (reduceMotion) {
      gameStartSound();
      return;
    }
    shuffleSound();
    setDealing({ dealerSeat: dealerSeat as SeatIndex });
  }, [handNumber]);

  const finishDeal = useCallback(() => {
    setDealing(null);
    gameStartSound();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(RECONNECT_STORAGE_KEY);
    if (!token) return;
    colyseusClient
      .reconnect(token)
      .then((joined) => attachRoom(joined))
      .catch(() => localStorage.removeItem(RECONNECT_STORAGE_KEY))
      .finally(() => setReconnecting(false));
  }, []);

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
    localStorage.setItem(RECONNECT_STORAGE_KEY, joined.reconnectionToken);
    joined.onStateChange((s: unknown) => setState((s as { toJSON: () => GameStateJSON }).toJSON()));
    joined.onMessage('hand', (cards: CardModel[]) => {
      setRawHand((prev) => {
        widowAddedRef.current =
          cards.length === 16 && prev.length === 12 ? cards.filter((c) => !prev.some((p) => cardsEqual(p, c))) : [];
        return cards;
      });
    });
    joined.onMessage('actionRejected', (payload: { reason?: string }) => setError(payload?.reason ?? 'Action rejected'));
  }

  /** A consented leave — the seat isn't coming back for this room (unlike a
   * dropped connection, which the reconnect flow above is for), so there's no
   * reason to hold onto the reconnection token or any in-room state. Reusing the
   * same table isn't supported server-side (no seat-vacating / reset), so the way
   * to "start over with the same players" is everyone leaving and one of them
   * creating a fresh table — hence dropping back to the create/join screen rather
   * than trying to reset in place. */
  function leaveTable() {
    room?.leave();
    localStorage.removeItem(RECONNECT_STORAGE_KEY);
    setRoom(null);
    setState(null);
    setRawHand([]);
    setSelectedCard(null);
    setWidowSelection([]);
    setRoomIdInput('');
    setError(null);
  }

  if (reconnecting) {
    return <div className={styles.lobbyWaiting}>Reconnecting…</div>;
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

  const bidLabelBySeat: Record<number, string> = {};
  state.bidHistory.forEach((b) => {
    bidLabelBySeat[b.seat] =
      b.bidType === 'numeric' ? String(b.amount) : b.bidType === 'shelem' ? 'Shelem' : b.bidType === 'sarShelem' ? 'Sar-Shelem' : 'Pass';
  });

  const tablePlayers = state.players
    .filter((p) => p.sessionId !== '')
    .map((p) => ({
      seat: p.seat as SeatIndex,
      name: p.name,
      connected: p.connected,
      handSize: p.handSize,
      // Bid history is only meaningful while bidding is actually happening — once the
      // round moves on, a lingering "Pass" badge next to someone's name is stale info.
      bidLabel: state.phase === 'bidding' ? bidLabelBySeat[p.seat] : undefined,
    }));

  // Teams aren't named "A"/"B" anywhere but the scoreboard — they're identified by
  // their two members' names there, and not labeled on the table at all.
  function teamName(team: Team): string {
    const members = tablePlayers.filter((p) => teamForSeat(p.seat) === team).map((p) => p.name);
    return members.length > 0 ? members.join(' - ') : team === 0 ? 'Team A' : 'Team B';
  }
  const team0Name = teamName(0);
  const team1Name = teamName(1);

  // Live per-hand progress (declarer vs. defenders) mapped onto team 0/1, mirroring
  // how the match score itself is split once the hand completes.
  const declarerTeam = state.declarerSeat >= 0 ? teamForSeat(state.declarerSeat as SeatIndex) : null;
  const team0HandPoints =
    declarerTeam === 0 ? state.declarerPointsCollected : declarerTeam === 1 ? state.defenderPointsCollected : 0;
  const team1HandPoints =
    declarerTeam === 1 ? state.declarerPointsCollected : declarerTeam === 0 ? state.defenderPointsCollected : 0;

  function sendBid(bid: Bid) {
    if (bid.type === 'numeric') room?.send('bid', { bidType: 'numeric', amount: bid.amount });
    else room?.send('bid', { bidType: bid.type });
  }

  function playCard(card: CardModel) {
    setSelectedCard(card);
    room?.send('playCard', { suit: card.suit, rank: card.rank });
  }

  function toggleWidowCard(card: CardModel) {
    setWidowSelection((prev) => {
      if (prev.some((c) => cardsEqual(c, card))) return prev.filter((c) => !cardsEqual(c, card));
      if (prev.length >= 4) return prev;
      return [...prev, card];
    });
  }

  function confirmWidowDiscard() {
    room?.send('discardWidow', { cards: widowSelection });
    setWidowSelection([]);
  }

  const winningBid = winningBidFrom(state);
  const currentTrickPlays = state.currentTrick.map((p) => ({ seat: p.seat as SeatIndex, card: toCard(p) }));
  const lastTrickPlays = state.lastTrick.map((p) => ({ seat: p.seat as SeatIndex, card: toCard(p) }));
  const leadSuit = currentTrickPlays.length > 0 ? currentTrickPlays[0].card.suit : null;
  const isMyTurn = state.currentTurnSeat === mySeat;
  const legal = trumpSuit && leadSuit ? legalCards(hand, leadSuit, trumpSuit) : hand;

  const pendingSwapForMe =
    state.pendingSeatSwap && state.pendingSeatSwap.toSeat === mySeat ? state.pendingSeatSwap : null;

  return (
    <MotionConfig reducedMotion="user">
    <div className={styles.gameShell}>
      <div className={styles.header}>
        <strong>Shelem</strong>
        <div className={styles.headerRight}>
          <span className={styles.roomCode}>Table code: {room.roomId}</span>
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
          <button type="button" className={styles.leaveBtn} onClick={leaveTable}>
            Leave table
          </button>
        </div>
      </div>

      {state.phase === 'matchComplete' && (
        <div className={styles.matchComplete}>
          {state.team0Score >= state.matchTargetScore ? `${team0Name} wins the match!` : `${team1Name} wins the match!`}
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
        currentTurnSeat={state.currentTurnSeat as SeatIndex}
        declarerSeat={state.declarerSeat as SeatIndex | -1}
        biddingInProgress={state.phase === 'bidding'}
        // The lobby and the bid grid want the table's full width; only the trick
        // pile needs to keep clear of the opponents' fans. See Table.module.css.
        centerVariant={state.phase === 'lobby' || state.phase === 'bidding' ? 'wide' : 'trick'}
        hideOwnLabel={state.phase === 'widow' && state.declarerSeat === mySeat}
        trumpSuit={trumpSuit}
        dealing={dealing}
        onDealDone={finishDeal}
        cornerPanel={
          state.phase !== 'lobby' ? (
            <ScoreBar
              team0Name={team0Name}
              team1Name={team1Name}
              team0Score={state.team0Score}
              team1Score={state.team1Score}
              team0HandPoints={team0HandPoints}
              team1HandPoints={team1HandPoints}
              matchTargetScore={state.matchTargetScore}
              handNumber={state.handNumber}
              handHistory={state.handHistory}
              playerNames={playerNames}
            />
          ) : null
        }
        cornerPanelRight={
          state.phase === 'playing' ? (
            <LastTrickPanel
              mySeat={mySeat}
              plays={lastTrickPlays}
              winnerSeat={state.lastTrickWinnerSeat as SeatIndex | -1}
              points={state.lastTrickPoints}
              playerNames={playerNames}
            />
          ) : null
        }
        center={
          state.phase === 'lobby' ? (
            <div className={styles.lobbyWaiting}>
              <TableSettings
                targetScore={state.matchTargetScore}
                isHost={room.sessionId === state.hostSessionId}
                onChangeTargetScore={(targetScore) => room?.send('setTableOption', { targetScore })}
              />
              {tablePlayers.length === 4 ? (
                <>
                  <div className={styles.big}>All 4 players are seated</div>
                  <button className={styles.startGameBtn} onClick={() => room?.send('startGame')}>
                    Start Game
                  </button>
                </>
              ) : (
                <>
                  <div className={styles.big}>Waiting for players…</div>
                  <div>{tablePlayers.length} / 4 seated</div>
                </>
              )}
            </div>
          ) : state.phase === 'bidding' ? (
            <BiddingPanel
              bidHistory={state.bidHistory.map((b) => ({ seat: b.seat as SeatIndex, bidType: b.bidType, amount: b.amount }))}
              mySeat={mySeat}
              currentTurnSeat={state.currentTurnSeat as SeatIndex}
              playerNames={playerNames}
              onBid={sendBid}
            />
          ) : (
            <TrickArea mySeat={mySeat} plays={currentTrickPlays} />
          )
        }
        bottomOverlay={
          state.phase === 'widow' && state.declarerSeat === mySeat ? (
            <Hand
              cards={hand}
              legalCards={hand}
              isMyTurn
              onPlay={() => {}}
              selectedCard={null}
              highlightedCards={widowAddedRef.current}
              discardSelection={widowSelection}
              onToggleDiscard={toggleWidowCard}
              onConfirmDiscard={confirmWidowDiscard}
            />
          ) : hand.length > 0 && state.phase !== 'widow' ? (
            <Hand
              cards={hand}
              legalCards={state.phase === 'playing' ? legal : []}
              isMyTurn={state.phase === 'playing' && isMyTurn}
              onPlay={playCard}
              selectedCard={selectedCard}
              trumpSuit={trumpSuit}
            />
          ) : null
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

      {error && <p className={styles.error}>{error}</p>}
    </div>
    </MotionConfig>
  );
}
