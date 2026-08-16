import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Room } from 'colyseus.js';
import { useReducedMotion } from 'framer-motion';
import type { Card as CardModel, Seat as SeatIndex, Team } from '@shelem/shared';
import { legalCards, shelem } from '@shelem/shared';
import styles from '../../App.module.css';
import { sortHand } from '../../cardSort';
import { seatOf, teamOf, toCard, type BaseStateJSON } from '../../roomState';
import { Table } from '../../components/Table.js';
import type { DealBlock } from '../../components/DealingOverlay.js';
import { TrickArea } from '../../components/TrickArea.js';
import { ScoreBar, type ScoreRow } from '../../components/ScoreBar.js';
import { Hand } from '../../components/Hand.js';
import { LastTrickPanel } from '../../components/LastTrickPanel.js';
import { TableShell } from '../../screens/TableShell.js';
import { BiddingPanel } from './BiddingPanel.js';
import { ConfigureTable } from './ConfigureTable.js';
import { RulesSummary } from './RulesSummary.js';
import { WidowReveal } from './WidowReveal.js';
import { bidLabel, winningBidFrom, type ShelemStateJSON } from './state.js';
import { bidSound, gameStartSound, playCardSound, shuffleSound, trickClearedSound } from '../../sound.js';

type Bid = shelem.Bid;

/** Shelem hands hold twelve. */
const MAX_HAND = 12;

/** Twelve to each seat in turn, then the four-card widow last — see DealingOverlay
 * for why the widow comes last here but fourth in the engine. */
function dealPlan(dealerSeat: SeatIndex): DealBlock[] {
  return [
    { target: ((dealerSeat + 1) % 4) as SeatIndex, count: 12 },
    { target: ((dealerSeat + 2) % 4) as SeatIndex, count: 12 },
    { target: ((dealerSeat + 3) % 4) as SeatIndex, count: 12 },
    { target: dealerSeat, count: 12 },
    { target: 'widow', count: 4 },
  ];
}

function cardsEqual(a: CardModel, b: CardModel): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

export interface ShelemGameProps {
  room: Room;
  state: BaseStateJSON;
  rawHand: CardModel[];
  onMessage: (type: string, handler: (payload: unknown) => void) => void;
  onLeave: () => void;
  error: string | null;
}

export function ShelemGame({ room, state: baseState, rawHand, onMessage, onLeave, error }: ShelemGameProps) {
  const state = baseState as ShelemStateJSON;

  const [selectedCard, setSelectedCard] = useState<CardModel | null>(null);
  const [widowSelection, setWidowSelection] = useState<CardModel[]>([]);
  const [dealing, setDealing] = useState<{ dealerSeat: SeatIndex; blocks: DealBlock[] } | null>(null);
  // The four cards a Sar-Shelem declarer is shown before they're buried.
  const [sarShelemWidow, setSarShelemWidow] = useState<CardModel[] | null>(null);
  // The 4 cards the widow pickup just added to the declarer's hand, computed as a
  // diff the moment the 16-card hand arrives — used to highlight them in place
  // rather than opening a separate picker for the discard.
  const widowAddedRef = useRef<CardModel[]>([]);
  const prevHandRef = useRef<CardModel[]>([]);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    onMessage('sarShelemWidow', (payload) => setSarShelemWidow(payload as CardModel[]));
  }, [onMessage]);

  // Trump is unknown (and every suit-color-alternating order is equivalent) until the
  // declarer's opening lead sets it — re-sort whenever that changes, not just on deal.
  const trumpSuit: CardModel['suit'] | null = state.trumpSuit ? (state.trumpSuit as CardModel['suit']) : null;
  const hand = useMemo(() => sortHand(rawHand, trumpSuit), [rawHand, trumpSuit]);

  // The widow arriving is the one hand change worth noticing: twelve cards becoming
  // sixteen means the declarer just picked it up, and the four new ones get
  // highlighted in place rather than shown in a separate picker.
  useEffect(() => {
    const prev = prevHandRef.current;
    widowAddedRef.current =
      rawHand.length === 16 && prev.length === 12 ? rawHand.filter((c) => !prev.some((p) => cardsEqual(p, c))) : [];
    prevHandRef.current = rawHand;
  }, [rawHand]);

  useEffect(() => {
    if (state.phase !== 'widow') setWidowSelection([]);
  }, [state.phase]);

  // Sound is driven off transitions in the synced state rather than off the local
  // player's own actions, so every seat's play is heard, not just our own.
  const prevTrickCount = useRef(0);
  const trickCount = state.currentTrick.length;
  useEffect(() => {
    if (trickCount > prevTrickCount.current) playCardSound();
    else if (trickCount === 0 && prevTrickCount.current > 0) trickClearedSound();
    prevTrickCount.current = trickCount;
  }, [trickCount]);

  const prevBidCount = useRef(0);
  const bidCount = state.bidHistory.length;
  useEffect(() => {
    if (bidCount > prevBidCount.current) bidSound();
    prevBidCount.current = bidCount;
  }, [bidCount]);

  // Each new deal, including a redeal after three passes.
  const handNumber = state.handNumber;
  const dealerSeat = state.dealerSeat;
  useEffect(() => {
    if (handNumber <= 0) return;
    if (reduceMotion) {
      gameStartSound();
      return;
    }
    shuffleSound();
    setDealing({ dealerSeat: dealerSeat as SeatIndex, blocks: dealPlan(dealerSeat as SeatIndex) });
  }, [handNumber]);

  const finishDeal = useCallback(() => {
    setDealing(null);
    gameStartSound();
  }, []);

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
      b.bidType === 'numeric'
        ? String(b.amount)
        : b.bidType === 'shelem'
          ? 'Shelem'
          : b.bidType === 'sarShelem'
            ? 'Sar-Shelem'
            : 'Pass';
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
      badgeLabel: state.phase === 'bidding' ? bidLabelBySeat[p.seat] : undefined,
      badgeMuted: bidLabelBySeat[p.seat] === 'Pass',
    }));

  // Teams aren't named "A"/"B" anywhere but the scoreboard — they're identified by
  // their two members' names there, and not labeled on the table at all.
  function teamName(team: Team): string {
    const members = tablePlayers.filter((p) => teamOf(state, p.seat) === team).map((p) => p.name);
    return members.length > 0 ? members.join(' - ') : team === 0 ? 'Team A' : 'Team B';
  }
  const team0Name = teamName(0);
  const team1Name = teamName(1);

  // Live per-hand progress (declarer vs. defenders) mapped onto team 0/1, mirroring
  // how the match score itself is split once the hand completes.
  const declarerTeam = state.declarerSeat >= 0 ? teamOf(state, state.declarerSeat) : null;
  const team0HandPoints =
    declarerTeam === 0 ? state.declarerPointsCollected : declarerTeam === 1 ? state.defenderPointsCollected : 0;
  const team1HandPoints =
    declarerTeam === 1 ? state.declarerPointsCollected : declarerTeam === 0 ? state.defenderPointsCollected : 0;

  const scoreRows: ScoreRow[] = state.handHistory.map((result) => ({
    key: result.handNumber,
    label: `${result.handNumber} (${playerNames[result.declarerSeat] ?? '—'})`,
    team0Delta: result.team0Delta,
    team1Delta: result.team1Delta,
  }));

  function sendBid(bid: Bid) {
    if (bid.type === 'numeric') room.send('bid', { bidType: 'numeric', amount: bid.amount });
    else room.send('bid', { bidType: bid.type });
  }

  function playCard(card: CardModel) {
    setSelectedCard(card);
    room.send('playCard', { suit: card.suit, rank: card.rank });
  }

  function toggleWidowCard(card: CardModel) {
    setWidowSelection((prev) => {
      if (prev.some((c) => cardsEqual(c, card))) return prev.filter((c) => !cardsEqual(c, card));
      if (prev.length >= 4) return prev;
      return [...prev, card];
    });
  }

  function confirmWidowDiscard() {
    room.send('discardWidow', { cards: widowSelection });
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

  // The widow is on the table from the end of the deal until it reaches whoever won
  // the bid. Held back while `dealing` is set so it doesn't sit there through the
  // animation that is still busy dealing it.
  const widow =
    (state.phase === 'bidding' || state.phase === 'widow') && !dealing
      ? {
          dealerSeat: state.dealerSeat as SeatIndex,
          declarerSeat: state.declarerSeat >= 0 ? (state.declarerSeat as SeatIndex) : null,
          faces: widowAddedRef.current,
          flip: !(isSarShelem && !state.config.sarShelemTakesWidow),
        }
      : null;

  return (
    <TableShell
      state={state}
      mySeat={mySeat}
      roomCode={room.roomId}
      playerNames={playerNames}
      onLeave={onLeave}
      onSeatSwapRequest={(toSeat) => room.send('requestSeatSwap', { toSeat })}
      onSeatSwapResponse={(accept) => room.send('respondSeatSwap', { accept })}
      error={error}
    >
      {(state.phase === 'widow' || state.phase === 'playing') && winningBid && (
        <div className={styles.lobbyWaiting}>
          {playerNames[state.declarerSeat]}'s team bid {bidLabel(winningBid)}
        </div>
      )}

      <Table
        mySeat={mySeat}
        players={tablePlayers}
        currentTurnSeat={state.currentTurnSeat as SeatIndex}
        roleSeat={state.declarerSeat as SeatIndex | -1}
        awaitingChoice={state.phase === 'bidding'}
        maxFanCards={MAX_HAND}
        centerVariant={
          state.phase === 'lobby' || state.phase === 'configuring' || state.phase === 'bidding' ? 'wide' : 'trick'
        }
        hideOwnLabel={state.phase === 'widow' && state.declarerSeat === mySeat}
        trumpSuit={trumpSuit}
        dealing={dealing}
        onDealDone={finishDeal}
        widow={widow}
        cornerPanel={
          state.phase !== 'lobby' && state.phase !== 'configuring' ? (
            <ScoreBar
              team0Name={team0Name}
              team1Name={team1Name}
              team0Score={state.team0Score}
              team1Score={state.team1Score}
              currentHand={{
                label: 'Current hand',
                team0: `+${team0HandPoints}`,
                team1: `+${team1HandPoints}`,
              }}
              matchTargetScore={state.config.targetScore}
              handHistory={scoreRows}
              heldOpen={state.phase === 'handComplete' || state.phase === 'matchComplete'}
              rematch={
                state.phase === 'matchComplete'
                  ? {
                      ready: state.players.filter((p) => p.sessionId !== '' && p.wantsRematch).length,
                      total: state.players.filter((p) => p.sessionId !== '').length,
                      iAmReady: !!state.players.find((p) => p.sessionId === room.sessionId)?.wantsRematch,
                      onPlayAgain: () => room.send('playAgain'),
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
              worth={`${state.lastTrickPoints} pts`}
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
                  <button className={styles.startGameBtn} onClick={() => room.send('startGame')}>
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
              bidHistory={state.bidHistory.map((b) => ({
                seat: b.seat as SeatIndex,
                bidType: b.bidType,
                amount: b.amount,
              }))}
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
          // comparison the reveal exists for.
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
          table was created on — the one moment a match's rules can change. */}
      {state.phase === 'configuring' && isHost && (
        <ConfigureTable
          initial={state.config}
          title="Next match"
          subtitle="You're the host this time. These rules are fixed for the whole match."
          submitLabel="Start next match"
          onSubmit={(config) => room.send('setTableConfig', config)}
        />
      )}

      {state.phase === 'widow' && state.declarerSeat === mySeat && isSarShelem && sarShelemWidow && (
        <WidowReveal
          cards={sarShelemWidow}
          onContinue={() => {
            room.send('confirmSarShelemWidow');
            setSarShelemWidow(null);
          }}
        />
      )}
    </TableShell>
  );
}
