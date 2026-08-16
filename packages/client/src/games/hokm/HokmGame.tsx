import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Room } from 'colyseus.js';
import { useReducedMotion } from 'framer-motion';
import type { Card as CardModel, Seat as SeatIndex, Suit, Team } from '@shelem/shared';
import { hokm, legalCards } from '@shelem/shared';
import styles from '../../App.module.css';
import { sortHand } from '../../cardSort';
import { useCountdownTicks, useServerClockOffset, useTurnCountdown } from '../../useTurnCountdown';
import { isOccupied, seatOf, teamOf, toCard, type BaseStateJSON } from '../../roomState';
import { Table } from '../../components/Table.js';
import type { DealBlock } from '../../components/DealingOverlay.js';
import { TrickArea } from '../../components/TrickArea.js';
import { ScoreBar, type ScoreRow } from '../../components/ScoreBar.js';
import { Hand } from '../../components/Hand.js';
import { LastTrickPanel } from '../../components/LastTrickPanel.js';
import { TableShell } from '../../screens/TableShell.js';
import { ConfigureTable } from './ConfigureTable.js';
import { RulesSummary } from './RulesSummary.js';
import { TrumpPicker } from './TrumpPicker.js';
import { HakemDraw } from './HakemDraw.js';
import { outcomeLabel, type HokmStateJSON } from './state.js';
import { gameStartSound, playCardSound, shuffleSound, trickClearedSound } from '../../sound.js';

const { HOKM_HAND_SIZE, HOKM_TRICKS_TO_WIN } = hokm;

const SUIT_SYMBOL: Record<string, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };

/**
 * Hokm's 5-4-4, starting with the Hâkem. The animation runs all three packets in
 * one go even though the engine stops after the first to wait for trump — the
 * remaining eight arrive the instant the Hâkem chooses, and splitting the animation
 * in two would put a stutter in the middle of a deal that at a real table is one
 * continuous motion.
 */
function dealPlan(hakemSeat: SeatIndex): DealBlock[] {
  const blocks: DealBlock[] = [];
  for (const size of [5, 4, 4]) {
    for (let offset = 0; offset < 4; offset++) {
      blocks.push({ target: ((hakemSeat + offset) % 4) as SeatIndex, count: size });
    }
  }
  return blocks;
}

export interface HokmGameProps {
  room: Room;
  state: BaseStateJSON;
  rawHand: CardModel[];
  onLeave: () => void;
  error: string | null;
}

export function HokmGame({ room, state: baseState, rawHand, onLeave, error }: HokmGameProps) {
  const state = baseState as HokmStateJSON;

  const [selectedCard, setSelectedCard] = useState<CardModel | null>(null);
  const [dealing, setDealing] = useState<{ dealerSeat: SeatIndex; blocks: DealBlock[] } | null>(null);
  const reduceMotion = useReducedMotion();

  const trumpSuit: Suit | null = state.trumpSuit ? (state.trumpSuit as Suit) : null;
  const hand = useMemo(() => sortHand(rawHand, trumpSuit), [rawHand, trumpSuit]);

  // Sound is driven off transitions in the synced state rather than off the local
  // player's own actions, so every seat's play is heard, not just our own.
  const prevTrickCount = useRef(0);
  const trickCount = state.currentTrick.length;
  useEffect(() => {
    if (trickCount > prevTrickCount.current) playCardSound();
    else if (trickCount === 0 && prevTrickCount.current > 0) trickClearedSound();
    prevTrickCount.current = trickCount;
  }, [trickCount]);

  // The deal is played when the cards actually go out, which in Hokm is when the
  // Hâkem is known and the opening packet lands — not at the top of the hand, since
  // a first hand may spend several seconds on the draw before anything is dealt.
  const handNumber = state.handNumber;
  const hakemSeat = state.hakemSeat;
  const dealStarted = state.phase === 'declaringTrump';
  useEffect(() => {
    if (handNumber <= 0 || !dealStarted || hakemSeat < 0) return;
    if (reduceMotion) {
      gameStartSound();
      return;
    }
    shuffleSound();
    setDealing({ dealerSeat: hakemSeat as SeatIndex, blocks: dealPlan(hakemSeat as SeatIndex) });
  }, [handNumber, dealStarted]);

  const finishDeal = useCallback(() => {
    setDealing(null);
    gameStartSound();
  }, []);

  const serverOffset = useServerClockOffset(room);
  const turn = useTurnCountdown(state.turnEndsAt, state.turnLimitMs, serverOffset);

  const mySeat = seatOf(room.sessionId, state.players);
  const playerNames: Record<number, string> = {};
  state.players.forEach((p) => (playerNames[p.seat] = p.name || `Seat ${p.seat + 1}`));
  // Before the early return below: a hook cannot sit after a conditional return.
  useCountdownTicks({
    remainingMs: turn.remainingMs,
    running: turn.running,
    isMyTurn: mySeat !== null && state.currentTurnSeat === mySeat,
  });

  const isHost = room.sessionId === state.hostSessionId;
  const hostSeat = seatOf(state.hostSessionId, state.players) ?? -1;

  if (mySeat === null) {
    return <div className={styles.lobbyWaiting}>Connecting…</div>;
  }

  // Only once cards are out: there is nothing to count during the draw or while
  // trump is being chosen. Stays up through the review pause at the end of a hand.
  const showHandScore =
    state.phase === 'playing' || state.phase === 'handComplete' || state.phase === 'matchComplete';

  const tablePlayers = state.players
    .filter(isOccupied)
    .map((p) => {
      const team = teamOf(state, p.seat);
      const isHakem = state.hakemSeat >= 0 && p.seat === state.hakemSeat;
      return {
        seat: p.seat as SeatIndex,
        name: p.name,
        connected: p.connected,
        handSize: p.handSize,
        // The Hâkem is worth marking from the moment they're known — but only until
        // trump exists, at which point the trump glyph is already sitting on this
        // exact seat and says the same thing. Dropping it then keeps the label to
        // three things, which is what it was deliberately pared down to.
        badgeLabel: isHakem && !trumpSuit ? 'Hâkem' : undefined,
        handScore: showHandScore
          ? { value: String(team === 0 ? state.team0Tricks : state.team1Tricks), team }
          : undefined,
      };
    });

  function teamName(team: Team): string {
    const members = tablePlayers.filter((p) => teamOf(state, p.seat) === team).map((p) => p.name);
    return members.length > 0 ? members.join(' - ') : team === 0 ? 'Team A' : 'Team B';
  }

  const scoreRows: ScoreRow[] = state.handHistory.map((result) => {
    const outcome = outcomeLabel(result.outcome);
    const trump = SUIT_SYMBOL[result.trumpSuit] ?? '';
    return {
      key: result.handNumber,
      label: `${result.handNumber} ${trump} (${playerNames[result.hakemSeat] ?? '—'})${outcome ? ` · ${outcome}` : ''}`,
      team0Delta: result.team0Delta,
      team1Delta: result.team1Delta,
    };
  });

  function playCard(card: CardModel) {
    setSelectedCard(card);
    room.send('playCard', { suit: card.suit, rank: card.rank });
  }

  const currentTrickPlays = state.currentTrick.map((p) => ({ seat: p.seat as SeatIndex, card: toCard(p) }));
  const lastTrickPlays = state.lastTrick.map((p) => ({ seat: p.seat as SeatIndex, card: toCard(p) }));
  const leadSuit = currentTrickPlays.length > 0 ? currentTrickPlays[0].card.suit : null;
  const isMyTurn = state.currentTurnSeat === mySeat;
  const legal = trumpSuit && leadSuit ? legalCards(hand, leadSuit, trumpSuit) : hand;
  const iAmHakem = state.hakemSeat === mySeat;

  return (
    <TableShell
      state={state}
      mySeat={mySeat}
      roomCode={room.roomId}
      playerNames={playerNames}
      onLeave={onLeave}
      onSeatSwapRequest={(toSeat) => room.send('requestSeatSwap', { toSeat })}
      onSeatSwapResponse={(accept) => room.send('respondSeatSwap', { accept })}
      canManageBots={isHost}
      onAddBot={(seat) => room.send('addBot', { seat })}
      onRemoveBot={(seat) => room.send('removeBot', { seat })}
      error={error}
    >
      {state.phase === 'playing' && trumpSuit && (
        <div className={styles.lobbyWaiting}>
          {playerNames[state.hakemSeat]} called {SUIT_SYMBOL[trumpSuit]} · first to {HOKM_TRICKS_TO_WIN} tricks
        </div>
      )}

      <Table
        mySeat={mySeat}
        players={tablePlayers}
        currentTurnSeat={state.currentTurnSeat as SeatIndex}
        roleSeat={state.hakemSeat as SeatIndex | -1}
        awaitingChoice={state.phase === 'declaringTrump'}
        maxFanCards={HOKM_HAND_SIZE}
        turnFraction={turn.fraction}
        centerVariant={state.phase === 'playing' ? 'trick' : 'wide'}
        trumpSuit={trumpSuit}
        dealing={dealing}
        onDealDone={finishDeal}
        cornerPanel={
          state.phase !== 'lobby' && state.phase !== 'configuring' ? (
            <ScoreBar
              team0Name={teamName(0)}
              team1Name={teamName(1)}
              team0Score={state.team0Score}
              team1Score={state.team1Score}
              currentHand={{
                label: `Tricks (of ${HOKM_TRICKS_TO_WIN})`,
                team0: String(state.team0Tricks),
                team1: String(state.team1Tricks),
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
            // No `worth` — a Hokm trick is worth exactly one trick, which the panel
            // already shows by existing. There are no card points to report.
            <LastTrickPanel
              mySeat={mySeat}
              plays={lastTrickPlays}
              winnerSeat={state.lastTrickWinnerSeat as SeatIndex | -1}
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
          ) : state.phase === 'hakemDraw' ? (
            <HakemDraw
              reveals={state.hakemDraw}
              playerNames={playerNames}
              mySeat={mySeat}
              hakemSeat={state.hakemSeat}
              swappedSeatA={state.swappedSeatA}
              swappedSeatB={state.swappedSeatB}
            />
          ) : state.phase === 'declaringTrump' ? (
            <TrumpPicker
              isHakem={iAmHakem}
              hakemName={playerNames[state.hakemSeat] ?? 'The Hâkem'}
              onDeclare={(suit) => room.send('declareTrump', { suit })}
            />
          ) : (
            <TrickArea mySeat={mySeat} plays={currentTrickPlays} />
          )
        }
        bottomOverlay={
          hand.length > 0 ? (
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

      {state.phase === 'configuring' && isHost && (
        <ConfigureTable
          initial={state.config}
          title="Next match"
          subtitle="You're the host this time. These rules are fixed for the whole match."
          submitLabel="Start next match"
          onSubmit={(config) => room.send('setTableConfig', config)}
        />
      )}
    </TableShell>
  );
}
