import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Room } from 'colyseus.js';
import { MotionConfig, useReducedMotion } from 'framer-motion';
import type { Card as CardModel, Seat as SeatIndex, Team } from '@shelem/shared';
import { legalCards, shelem, teamForSeat } from '@shelem/shared';

type Bid = shelem.Bid;
type TableConfig = shelem.TableConfig;
const { DEFAULT_TABLE_CONFIG, validateTableConfig } = shelem;
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
import { ConfigureTable } from './components/ConfigureTable.js';
import { RulesSummary } from './components/RulesSummary.js';
import { WidowReveal } from './components/WidowReveal.js';
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

/** The last rules this browser created a table with, so someone who plays the same
 * house rules every week doesn't re-enter them every week. Only a starting point for
 * the create screen — the table's actual rules are whatever the server accepted. */
const CONFIG_STORAGE_KEY = 'shelem:tableConfig';

function loadStoredConfig(): TableConfig {
  const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
  if (!stored) return DEFAULT_TABLE_CONFIG;
  try {
    // Validated rather than trusted: this is old data from a possibly older version
    // of the game, and a config that no longer passes should quietly become the
    // default rather than pre-filling a form that can't be submitted.
    const parsed = validateTableConfig(JSON.parse(stored));
    return parsed.ok ? parsed.config : DEFAULT_TABLE_CONFIG;
  } catch {
    return DEFAULT_TABLE_CONFIG;
  }
}

export default function App() {
  const [name, setName] = useState('');
  const [roomIdInput, setRoomIdInput] = useState('');
  // Set while the create-table screen is open, before any room exists.
  const [configuringNewTable, setConfiguringNewTable] = useState(false);
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
  // The four cards a Sar-Shelem declarer is shown before they're buried.
  const [sarShelemWidow, setSarShelemWidow] = useState<CardModel[] | null>(null);
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

  async function createTable(config: TableConfig) {
    try {
      const joined = await colyseusClient.create('shelem', { name, config });
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
      setConfiguringNewTable(false);
      attachRoom(joined);
    } catch (err) {
      setError(String(err));
    }
  }

  async function joinTable() {
    try {
      // Codes are generated uppercase (see ShelemRoom); accept them typed either way.
      const joined = await colyseusClient.joinById(roomIdInput.trim().toUpperCase(), { name });
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
    joined.onMessage('sarShelemWidow', (cards: CardModel[]) => setSarShelemWidow(cards));
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
    setSarShelemWidow(null);
    setRoomIdInput('');
    setConfiguringNewTable(false);
    setError(null);
  }

  if (reconnecting) {
    return <div className={styles.lobbyWaiting}>Reconnecting…</div>;
  }

  if (configuringNewTable) {
    return (
      <ConfigureTable
        initial={loadStoredConfig()}
        title="New table"
        subtitle="These rules are fixed for the whole match, so settle them now."
        submitLabel="Create table"
        onSubmit={createTable}
        onCancel={() => setConfiguringNewTable(false)}
      />
    );
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

          <button className={styles.primaryBtn} onClick={() => setConfiguringNewTable(true)} disabled={!name}>
            Create a table
          </button>

          <div className={styles.divider}>— or join with a table code —</div>

          <label className={styles.field}>
            Table code
            <input
            className={`${styles.input} ${styles.codeInput}`}
            value={roomIdInput}
            onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
            maxLength={4}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
placeholder="ABCD"
          />
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
  const isHost = room.sessionId === state.hostSessionId;
  const hostSeat = seatOf(state.hostSessionId, state.players) ?? -1;

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
  // A Sar-Shelem declarer never picks a discard, so the widow phase looks entirely
  // different for them: no picker, just the reveal below.
  const isSarShelem = state.winningBidType === 'sarShelem';
  const currentTrickPlays = state.currentTrick.map((p) => ({ seat: p.seat as SeatIndex, card: toCard(p) }));
  const lastTrickPlays = state.lastTrick.map((p) => ({ seat: p.seat as SeatIndex, card: toCard(p) }));
  const leadSuit = currentTrickPlays.length > 0 ? currentTrickPlays[0].card.suit : null;
  const isMyTurn = state.currentTurnSeat === mySeat;
  const legal = trumpSuit && leadSuit ? legalCards(hand, leadSuit, trumpSuit) : hand;

  const pendingSwapForMe =
    state.pendingSeatSwap && state.pendingSeatSwap.toSeat === mySeat ? state.pendingSeatSwap : null;

  // The widow is on the table from the end of the deal until it reaches whoever won
  // the bid. Held back while `dealing` is set so it doesn't sit there through the
  // animation that is still busy dealing it — the deal's last block lands on this
  // exact spot, and the pile takes over from there. On a redeal `dealing` comes back,
  // which is what triggers the pile's fly-back on the way out.
  const widow =
    (state.phase === 'bidding' || state.phase === 'widow') && !dealing
      ? {
          dealerSeat: state.dealerSeat as SeatIndex,
          declarerSeat: state.declarerSeat >= 0 ? (state.declarerSeat as SeatIndex) : null,
          // Only ever non-empty on the declarer's own client: it's the diff between
          // their 12-card hand and the 16 that came back.
          faces: widowAddedRef.current,
          // A Sar-Shelem played without the exchange never puts these cards in a
          // hand — they're buried unchosen — so WidowReveal is the reveal, not this.
          flip: !(isSarShelem && !state.config.sarShelemTakesWidow),
        }
      : null;

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
        centerVariant={
          state.phase === 'lobby' || state.phase === 'configuring' || state.phase === 'bidding' ? 'wide' : 'trick'
        }
        hideOwnLabel={state.phase === 'widow' && state.declarerSeat === mySeat}
        trumpSuit={trumpSuit}
        dealing={dealing}
        onDealDone={finishDeal}
        widow={widow}
        cornerPanel={
          // Nothing to score between matches: the totals have already been reset and
          // the next match's rules aren't settled yet.
          state.phase !== 'lobby' && state.phase !== 'configuring' ? (
            <ScoreBar
              team0Name={team0Name}
              team1Name={team1Name}
              team0Score={state.team0Score}
              team1Score={state.team1Score}
              team0HandPoints={team0HandPoints}
              team1HandPoints={team1HandPoints}
              matchTargetScore={state.config.targetScore}
              handNumber={state.handNumber}
              handHistory={state.handHistory}
              playerNames={playerNames}
              // The game holds the scores up at the end of a hand so everyone reads
              // the result, and at the end of a match until the table agrees to play
              // again — neither is the player's to dismiss.
              heldOpen={state.phase === 'handComplete' || state.phase === 'matchComplete'}
              rematch={
                state.phase === 'matchComplete'
                  ? {
                      ready: state.players.filter((p) => p.sessionId !== '' && p.wantsRematch).length,
                      total: state.players.filter((p) => p.sessionId !== '').length,
                      iAmReady: !!state.players.find((p) => p.sessionId === room.sessionId)?.wantsRematch,
                      onPlayAgain: () => room?.send('playAgain'),
                    }
                  : undefined
              }
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
          state.phase === 'configuring' ? (
            <div className={styles.lobbyWaiting}>
              <div className={styles.big}>
                {isHost ? 'Set the rules for the next match' : `${playerNames[hostSeat]} is setting the rules…`}
              </div>
            </div>
          ) : state.phase === 'lobby' ? (
            <div className={styles.lobbyWaiting}>
              <RulesSummary config={state.config} />
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
              onBid={sendBid}
            />
          ) : (
            <TrickArea mySeat={mySeat} plays={currentTrickPlays} />
          )
        }
        bottomOverlay={
          state.phase === 'widow' && state.declarerSeat === mySeat && !isSarShelem ? (
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
          ) : // A Sar-Shelem declarer keeps their twelve through the widow phase and
          // should see them while the four buried cards are on screen — that is the
          // comparison the reveal exists for. It also means the hand doesn't pop
          // into existence the moment they press Continue.
          hand.length > 0 && (state.phase !== 'widow' || isSarShelem) ? (
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

      {/* A rematch draws a new host and sends them back through the same screen the
          table was created on — the one moment a match's rules can change. No Back: the
          room already exists and the other three are waiting on this. Submitting both
          sets the rules and releases the table into the lobby, in one message. */}
      {state.phase === 'configuring' && isHost && (
        <ConfigureTable
          initial={state.config}
          title="Next match"
          subtitle="You're the host this time. These rules are fixed for the whole match."
          submitLabel="Start next match"
          onSubmit={(config) => room?.send('setTableConfig', config)}
        />
      )}

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

      {state.phase === 'widow' && state.declarerSeat === mySeat && isSarShelem && sarShelemWidow && (
        <WidowReveal
          cards={sarShelemWidow}
          onContinue={() => {
            room?.send('confirmSarShelemWidow');
            setSarShelemWidow(null);
          }}
        />
      )}

      {error && <p className={styles.error}>{error}</p>}
    </div>
    </MotionConfig>
  );
}
