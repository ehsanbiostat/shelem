import { boot, type ColyseusTestServer } from '@colyseus/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import appConfig from '../app.config.js';
import type { HokmRoom } from './HokmRoom.js';

/**
 * Bots as table occupants, and bots as players.
 *
 * The seating half matters as much as the playing half: every occupancy test used
 * to read `sessionId !== ''`, which a bot can never satisfy, so a table with bots
 * in it could otherwise never start, never rematch, and hand a bot's seat to a
 * swap request.
 */

let colyseus: ColyseusTestServer;

beforeAll(async () => {
  colyseus = await boot(appConfig);
});

afterAll(async () => {
  await colyseus.shutdown();
});

beforeEach(async () => {
  await colyseus.cleanup();
});

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Waits for a condition, since bots act on a deliberate think-delay. */
async function until(fn: () => boolean, label: string, timeout = 40000) {
  const deadline = Date.now() + timeout;
  while (!fn()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
    await wait(60);
  }
}

/** One human host, plus bots in the other three seats.
 *
 * `hurry` turns the bots' think-pause down to nothing. At the real 500-1400ms a
 * single hand takes most of a minute — correct at a table, useless in a suite. */
async function soloTable(config: Record<string, unknown> = { hakemSelection: 'random' }, hurry = false) {
  const room = await colyseus.createRoom<HokmRoom>('hokm', { config });
  if (hurry) (room as unknown as { botThinkMs: [number, number] }).botThinkMs = [1, 5];
  const host = await colyseus.connectTo(room, { name: 'Ann' });
  for (const seat of [1, 2, 3]) host.send('addBot', { seat });
  await room.waitForNextPatch();
  return { room, host };
}

/**
 * Plays the human seat, so the bots have someone to play against.
 *
 * Goes over the wire like any client would, and follows suit the way the rules
 * require — a seat that played illegally would simply be ignored by the server
 * and the hand would stall, which would look like a bot bug.
 */
function drivePlayer(room: HokmRoom, client: { send: (t: string, m?: unknown) => void }, seat: number) {
  let hand: { suit: string; rank: string }[] = [];
  (client as unknown as { onMessage: (t: string, cb: (p: unknown) => void) => void }).onMessage('hand', (cards) => {
    hand = cards as { suit: string; rank: string }[];
  });

  const timer = setInterval(() => {
    if (room.state.phase !== 'playing') return;
    if (room.state.currentTurnSeat !== seat) return;
    if (hand.length === 0) return;

    const lead = room.state.currentTrick.length > 0 ? room.state.currentTrick[0].suit : null;
    const card = (lead && hand.find((c) => c.suit === lead)) || hand[0];
    client.send('playCard', { suit: card.suit, rank: card.rank });
  }, 40);

  return () => clearInterval(timer);
}

describe('seating a bot', () => {
  it('fills a seat, names it, and marks it as a bot', async () => {
    const { room } = await soloTable();

    expect(room.state.players.map((p) => p.isBot)).toEqual([false, true, true, true]);
    expect(room.state.players[1].name).toBe('Bot 2');
    expect(room.state.players[0].name).toBe('Ann');
  });

  it('lets a table of one human and three bots start', async () => {
    const { room, host } = await soloTable();

    host.send('startGame');
    await room.waitForNextPatch();

    expect(room.state.phase).not.toBe('lobby');
    expect(room.state.handNumber).toBe(1);
  });

  it('refuses a fourth bot — somebody has to be playing against them', async () => {
    const room = await colyseus.createRoom<HokmRoom>('hokm', { config: { hakemSelection: 'random' } });
    const host = await colyseus.connectTo(room, { name: 'Ann' });
    for (const seat of [1, 2, 3]) host.send('addBot', { seat });
    await room.waitForNextPatch();

    // Seat 0 is the host's own, so this is really a check that the cap holds.
    host.send('addBot', { seat: 0 });
    await room.waitForNextPatch();

    expect(room.state.players.filter((p) => p.isBot).length).toBe(3);
  });

  it('only lets the host seat a bot', async () => {
    const room = await colyseus.createRoom<HokmRoom>('hokm', {});
    await colyseus.connectTo(room, { name: 'Ann' });
    const guest = await colyseus.connectTo(room, { name: 'Bo' });

    guest.send('addBot', { seat: 2 });
    await room.waitForNextPatch();

    expect(room.state.players[2].isBot).toBe(false);
  });

  it('will not put a bot on top of a seated player', async () => {
    const room = await colyseus.createRoom<HokmRoom>('hokm', {});
    const host = await colyseus.connectTo(room, { name: 'Ann' });
    await colyseus.connectTo(room, { name: 'Bo' });

    host.send('addBot', { seat: 1 });
    await room.waitForNextPatch();

    expect(room.state.players[1].isBot).toBe(false);
    expect(room.state.players[1].name).toBe('Bo');
  });

  it('removes a bot again, leaving the seat open', async () => {
    const { room, host } = await soloTable();

    host.send('removeBot', { seat: 2 });
    await room.waitForNextPatch();

    expect(room.state.players[2].isBot).toBe(false);
    expect(room.state.players[2].name).toBe('');
  });

  it('gives a bot seat to a person who turns up late', async () => {
    const { room } = await soloTable();

    const latecomer = await colyseus.connectTo(room, { name: 'Bo' });
    await room.waitForNextPatch();

    const seat = room.state.players.findIndex((p) => p.sessionId === latecomer.sessionId);
    expect(seat).toBeGreaterThan(0);
    expect(room.state.players[seat].isBot).toBe(false);
    expect(room.state.players[seat].name).toBe('Bo');
    expect(room.state.players.filter((p) => p.isBot).length).toBe(2);
  });

  it('does not offer a bot as a seat-swap partner', async () => {
    const room = await colyseus.createRoom<HokmRoom>('hokm', {});
    const host = await colyseus.connectTo(room, { name: 'Ann' });
    host.send('addBot', { seat: 2 });
    await room.waitForNextPatch();

    host.send('requestSeatSwap', { toSeat: 2 });
    await room.waitForNextPatch();

    expect(room.state.pendingSeatSwap).toBeUndefined();
  });

  it('refuses bots at a game that has no bot logic yet', async () => {
    const room = await colyseus.createRoom('shelem', {});
    const host = await colyseus.connectTo(room, { name: 'Ann' });

    host.send('addBot', { seat: 1 });
    await room.waitForNextPatch();

    expect(room.state.players[1].isBot).toBe(false);
  });
});

describe('bots playing', () => {
  /**
   * Waits until trump exists, or until it is the human's turn to name it.
   *
   * Not "wait for the declaringTrump phase" — when the Hâkem is a bot it names
   * trump in well under a millisecond, so the phase is gone before any poll can
   * see it. Watching for the *outcome* rather than the passing state is what makes
   * this reliable, and that speed is the whole point of the design.
   */
  async function untilTrump(room: HokmRoom) {
    await until(
      () => room.state.trumpSuit !== '' || (room.state.phase === 'declaringTrump' && room.state.hakemSeat === 0),
      'trump, or the human being asked for it',
    );
  }

  it('names trump for itself when the Hakem is a bot', async () => {
    // Which seat draws the Hakem is luck, so try tables until a bot gets it.
    for (let attempt = 0; attempt < 12; attempt++) {
      const { room, host } = await soloTable({ hakemSelection: 'random' }, true);
      host.send('startGame');
      await untilTrump(room);

      if (room.state.hakemSeat === 0) {
        await colyseus.cleanup();
        continue;
      }

      expect(['spades', 'hearts', 'diamonds', 'clubs']).toContain(room.state.trumpSuit);
      expect(room.state.phase).toBe('playing');
      return;
    }
    throw new Error('never drew a bot as Hakem');
  });

  it('plays a hand out to seven tricks against one human', async () => {
    const { room, host } = await soloTable({ hakemSelection: 'random' }, true);
    const stop = drivePlayer(room, host, 0);
    host.send('startGame');

    try {
      await untilTrump(room);
      if (room.state.trumpSuit === '') host.send('declareTrump', { suit: 'spades' });

      await until(
        () => Math.max(room.state.team0Tricks, room.state.team1Tricks) >= 7,
        'a side to reach seven tricks',
      );
    } finally {
      stop();
    }

    // Seven wins it, and the hand stops there rather than playing all thirteen.
    expect(Math.max(room.state.team0Tricks, room.state.team1Tricks)).toBe(7);
    expect(room.state.team0Tricks + room.state.team1Tricks).toBeLessThanOrEqual(13);
  }, 90000);

  it('finishes a whole match, scoring the hand it just played', async () => {
    // targetScore 1 so a single hand settles it.
    const { room, host } = await soloTable({ hakemSelection: 'random', targetScore: 1 }, true);
    const stop = drivePlayer(room, host, 0);
    host.send('startGame');

    try {
      await untilTrump(room);
      if (room.state.trumpSuit === '') host.send('declareTrump', { suit: 'spades' });
      await until(() => room.state.phase === 'matchComplete', 'the match to finish');
    } finally {
      stop();
    }

    expect(room.state.handHistory.length).toBe(1);
    expect(Math.max(room.state.team0Score, room.state.team1Score)).toBeGreaterThanOrEqual(1);
    expect(['normal', 'kot', 'hakemKoti']).toContain(room.state.handHistory[0].outcome);
  }, 90000);

  it('lets a rematch go ahead without waiting on the bots to vote', async () => {
    const { room, host } = await soloTable();
    host.send('startGame');
    await until(() => room.state.phase === 'declaringTrump', 'the deal');

    room.state.phase = 'matchComplete';
    await room.waitForNextPatch();

    host.send('playAgain');
    await room.waitForNextPatch();

    expect(room.state.phase).toBe('configuring');
  });
});
