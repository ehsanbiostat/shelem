import { boot, type ColyseusTestServer } from '@colyseus/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import appConfig from '../app.config.js';
import type { HokmRoom } from './HokmRoom.js';
import type { ShelemRoom } from './ShelemRoom.js';

/**
 * The turn clock: when it is armed, when it must not be, and what happens when it
 * runs out.
 *
 * Most of these assert on `turnEndsAt` rather than waiting for a timeout, because
 * *when the clock runs* is the part that is easy to get wrong and cheap to check.
 * Only the two that must observe a real expiry pay for the wait.
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

async function until(fn: () => boolean, label: string, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (!fn()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
    await wait(50);
  }
}

/** The shortest limit the rules allow, so a test that must watch one expire waits
 * seconds rather than half a minute. */
const SHORT_LIMIT = 5;

async function hokmTable(config: Record<string, unknown> = {}) {
  const room = await colyseus.createRoom<HokmRoom>('hokm', {
    config: { hakemSelection: 'random', turnLimitSeconds: SHORT_LIMIT, ...config },
  });
  const clients = [];
  for (const name of ['Ann', 'Bo', 'Cy', 'Di']) clients.push(await colyseus.connectTo(room, { name }));
  return { room, clients };
}

async function shelemTable(config: Record<string, unknown> = {}) {
  const room = await colyseus.createRoom<ShelemRoom>('shelem', {
    config: { turnLimitSeconds: SHORT_LIMIT, ...config },
  });
  const clients = [];
  for (const name of ['Ann', 'Bo', 'Cy', 'Di']) clients.push(await colyseus.connectTo(room, { name }));
  return { room, clients };
}

describe('when the clock runs', () => {
  it('arms as soon as a person is asked to bid', async () => {
    const { room, clients } = await shelemTable();
    clients[0].send('startGame');
    await until(() => room.state.phase === 'bidding', 'bidding');

    expect(room.state.turnEndsAt).toBeGreaterThan(Date.now());
    expect(room.state.turnLimitMs).toBeGreaterThan(0);
  });

  it('gives a bid longer than a card, and the opening bid the deal animation too', async () => {
    const { room, clients } = await shelemTable();
    clients[0].send('startGame');
    await until(() => room.state.phase === 'bidding', 'bidding');

    // Deliberate (2x) plus the deal allowance, because the client is still
    // animating the deal when the first player is asked to bid.
    const opening = room.state.turnLimitMs;
    expect(opening).toBeGreaterThan(SHORT_LIMIT * 2 * 1000);

    clients[room.state.currentTurnSeat].send('bid', { bidType: 'pass' });
    await until(() => room.state.bidHistory.length === 1, 'the second bidder');

    // The second bidder gets the long clock but not the allowance — the deal
    // finished animating a while ago.
    expect(room.state.turnLimitMs).toBe(SHORT_LIMIT * 2 * 1000);
    expect(room.state.turnLimitMs).toBeLessThan(opening);
  });

  it('stops the moment the player acts', async () => {
    const { room, clients } = await shelemTable();
    clients[0].send('startGame');
    await until(() => room.state.phase === 'bidding', 'bidding');

    const seat = room.state.currentTurnSeat;
    clients[seat].send('bid', { bidType: 'pass' });
    await until(() => room.state.currentTurnSeat !== seat, 'the turn to move on');

    // Re-armed for the next player, not left running for the one who acted.
    expect(room.state.turnEndsAt).toBeGreaterThan(Date.now());
    expect(room.state.currentTurnSeat).not.toBe(seat);
  });

  it('does not run in the lobby, before anyone owes anything', async () => {
    const { room } = await shelemTable();
    expect(room.state.turnEndsAt).toBe(0);
  });

  it('does not run while a finished trick is being held on screen', async () => {
    // The table is showing the completed trick for a beat; nobody can act, so a
    // clock over it would charge a player for time they never had.
    const { room, clients } = await hokmTable();
    clients[0].send('startGame');
    await until(() => room.state.trumpSuit !== '' || room.state.phase === 'declaringTrump', 'the deal');
    if (room.state.trumpSuit === '') {
      clients[room.state.hakemSeat].send('declareTrump', { suit: 'spades' });
      await until(() => room.state.phase === 'playing', 'play');
    }

    (room as unknown as { resolvingTrick: boolean }).resolvingTrick = true;
    (room as unknown as { scheduleTurn: () => void }).scheduleTurn();

    expect(room.state.turnEndsAt).toBe(0);
  });

  it('does not run over a bot, which answers on its own schedule', async () => {
    const room = await colyseus.createRoom<HokmRoom>('hokm', {
      config: { hakemSelection: 'random', turnLimitSeconds: SHORT_LIMIT },
    });
    const host = await colyseus.connectTo(room, { name: 'Ann' });
    for (const seat of [1, 2, 3]) host.send('addBot', { seat });
    await room.waitForNextPatch();
    host.send('startGame');
    await until(() => room.state.phase !== 'lobby', 'the hand to start');

    // Whenever a bot is on turn there is no countdown to draw.
    for (let i = 0; i < 20; i++) {
      const seat = room.state.currentTurnSeat;
      if (seat >= 0 && room.state.players[seat].isBot) {
        expect(room.state.turnEndsAt).toBe(0);
        return;
      }
      await wait(100);
    }
  });

  it('does not run at all when the table turned the clock off', async () => {
    const { room, clients } = await shelemTable({ turnLimitSeconds: 0 });
    clients[0].send('startGame');
    await until(() => room.state.phase === 'bidding', 'bidding');

    // Exactly how the platform behaved before the clock existed: the table waits.
    expect(room.state.turnEndsAt).toBe(0);
    expect(room.state.turnLimitMs).toBe(0);
  });
});

describe('when the clock runs out', () => {
  it('passes for a Shelem player who never bids, and the auction moves on', async () => {
    const { room, clients } = await shelemTable();
    clients[0].send('startGame');
    await until(() => room.state.phase === 'bidding', 'bidding');

    const seat = room.state.currentTurnSeat;
    const bidsBefore = room.state.bidHistory.length;

    await until(() => room.state.bidHistory.length > bidsBefore, 'the clock to bid for them', 20000);

    const recorded = room.state.bidHistory[room.state.bidHistory.length - 1];
    expect(recorded.seat).toBe(seat);
    expect(recorded.bidType).toBe('pass');
    expect(room.state.currentTurnSeat).not.toBe(seat);
  }, 60000);

  it('keeps running for a player who has disconnected — the case it exists for', async () => {
    // Before this, one dropped player froze the table for up to 24 hours.
    const { room, clients } = await shelemTable();
    clients[0].send('startGame');
    await until(() => room.state.phase === 'bidding', 'bidding');

    const seat = room.state.currentTurnSeat;
    await clients[seat].leave(false); // not consented: a dropped connection
    await room.waitForNextPatch();
    expect(room.state.players[seat].connected).toBe(false);

    await until(() => room.state.currentTurnSeat !== seat, 'the table to play on without them', 20000);

    expect(room.state.bidHistory.some((b) => b.seat === seat && b.bidType === 'pass')).toBe(true);
    // Their seat is still theirs to come back to.
    expect(room.state.players[seat].sessionId).not.toBe('');
  }, 60000);

  it('plays a legal card for a Shelem player who stalls mid-hand', async () => {
    const { room, clients } = await shelemTable();
    clients[0].send('startGame');
    await until(() => room.state.phase === 'bidding', 'bidding');

    // One bid, then let the other three time out into passes.
    clients[room.state.currentTurnSeat].send('bid', { bidType: 'numeric', amount: 100 });
    await until(() => room.state.phase === 'widow', 'the widow', 60000);

    // The declarer stalls too; the clock buries four for them.
    await until(() => room.state.phase === 'playing', 'the discard to be made for them', 30000);
    expect(room.state.players.map((p) => p.handSize)).toEqual([12, 12, 12, 12]);

    // And then plays a card for whoever is on lead.
    const trickBefore = room.state.currentTrick.length;
    await until(() => room.state.currentTrick.length > trickBefore, 'a card to be played', 20000);
    expect(room.state.trumpSuit).not.toBe('');
  }, 120000);
});
