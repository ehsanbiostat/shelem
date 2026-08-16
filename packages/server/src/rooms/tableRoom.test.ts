import { boot, type ColyseusTestServer } from '@colyseus/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import appConfig from '../app.config.js';

/**
 * Covers the half of a room that has nothing to do with which game is being played:
 * seating, host election, seat swaps, disconnection, and the rematch vote. Written
 * against ShelemRoom before that class was split into BaseTableRoom + game rules,
 * precisely so the split could be shown not to change any of it — every assertion
 * here passed before the refactor and after it, unchanged.
 *
 * This is also why the assertions go through the wire (join, send, read state)
 * rather than calling methods on the room: the point is the behaviour four real
 * clients see, not the shape the implementation currently happens to have.
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

/** Seats four named clients in order and hands back the room and the clients. */
async function seatFour(names = ['Ann', 'Bo', 'Cy', 'Di']) {
  const room = await colyseus.createRoom('shelem', {});
  const clients = [];
  for (const name of names) {
    clients.push(await colyseus.connectTo(room, { name }));
  }
  return { room, clients };
}

describe('seating', () => {
  it('seats players in join order and keeps the name each gave', async () => {
    const { room } = await seatFour();

    expect(room.state.players.length).toBe(4);
    expect(room.state.players.map((p) => p.name)).toEqual(['Ann', 'Bo', 'Cy', 'Di']);
    expect(room.state.players.map((p) => p.seat)).toEqual([0, 1, 2, 3]);
    expect(room.state.players.every((p) => p.connected)).toBe(true);
  });

  it('falls back to a numbered name when a player gives none', async () => {
    const room = await colyseus.createRoom('shelem', {});
    await colyseus.connectTo(room, {});
    await colyseus.connectTo(room, { name: '   ' });

    expect(room.state.players[0].name).toBe('Player 1');
    expect(room.state.players[1].name).toBe('Player 2');
  });

  it('refuses a fifth player at a four-seat table', async () => {
    const { room } = await seatFour();
    await expect(colyseus.connectTo(room, { name: 'Ed' })).rejects.toBeTruthy();
  });

  it('starts in the lobby, with nobody to act and no hand dealt', async () => {
    const room = await colyseus.createRoom('shelem', {});
    expect(room.state.phase).toBe('lobby');
    expect(room.state.currentTurnSeat).toBe(-1);
    expect(room.state.handNumber).toBe(0);
  });
});

describe('host election', () => {
  it('makes the first player to sit down the host', async () => {
    const { room, clients } = await seatFour();
    expect(room.state.hostSessionId).toBe(clients[0].sessionId);
  });

  it('does not hand the role to anyone else as the table fills', async () => {
    const room = await colyseus.createRoom('shelem', {});
    const first = await colyseus.connectTo(room, { name: 'Ann' });
    const firstHost = room.state.hostSessionId;
    await colyseus.connectTo(room, { name: 'Bo' });
    await colyseus.connectTo(room, { name: 'Cy' });

    expect(room.state.hostSessionId).toBe(firstHost);
    expect(room.state.hostSessionId).toBe(first.sessionId);
  });
});

describe('starting the game', () => {
  it('will not deal until every seat is filled', async () => {
    const room = await colyseus.createRoom('shelem', {});
    const first = await colyseus.connectTo(room, { name: 'Ann' });
    await colyseus.connectTo(room, { name: 'Bo' });

    first.send('startGame');
    await room.waitForNextPatch();

    expect(room.state.phase).toBe('lobby');
    expect(room.state.handNumber).toBe(0);
  });

  it('deals once any seated player starts a full table', async () => {
    const { room, clients } = await seatFour();

    clients[2].send('startGame');
    await room.waitForNextPatch();

    expect(room.state.phase).toBe('bidding');
    expect(room.state.handNumber).toBe(1);
    expect(room.state.players.map((p) => p.handSize)).toEqual([12, 12, 12, 12]);
  });
});

describe('seat swap', () => {
  it('swaps the two players when the request is accepted', async () => {
    const { room, clients } = await seatFour();

    clients[0].send('requestSeatSwap', { toSeat: 2 });
    await room.waitForNextPatch();
    expect(room.state.pendingSeatSwap?.fromSeat).toBe(0);
    expect(room.state.pendingSeatSwap?.toSeat).toBe(2);

    clients[2].send('respondSeatSwap', { accept: true });
    await room.waitForNextPatch();

    expect(room.state.players[0].name).toBe('Cy');
    expect(room.state.players[2].name).toBe('Ann');
    expect(room.state.players[0].sessionId).toBe(clients[2].sessionId);
    expect(room.state.players[2].sessionId).toBe(clients[0].sessionId);
    expect(room.state.pendingSeatSwap).toBeUndefined();
  });

  it('leaves both players where they were when the request is declined', async () => {
    const { room, clients } = await seatFour();

    clients[0].send('requestSeatSwap', { toSeat: 2 });
    await room.waitForNextPatch();
    clients[2].send('respondSeatSwap', { accept: false });
    await room.waitForNextPatch();

    expect(room.state.players[0].name).toBe('Ann');
    expect(room.state.players[2].name).toBe('Cy');
    expect(room.state.pendingSeatSwap).toBeUndefined();
  });

  it('ignores a response from anyone but the player being asked', async () => {
    const { room, clients } = await seatFour();

    clients[0].send('requestSeatSwap', { toSeat: 2 });
    await room.waitForNextPatch();
    clients[1].send('respondSeatSwap', { accept: true });
    await room.waitForNextPatch();

    expect(room.state.pendingSeatSwap?.fromSeat).toBe(0);
    expect(room.state.players[0].name).toBe('Ann');
  });

  it('ignores a request to swap with an empty seat, or with yourself', async () => {
    const room = await colyseus.createRoom('shelem', {});
    const first = await colyseus.connectTo(room, { name: 'Ann' });
    await colyseus.connectTo(room, { name: 'Bo' });

    first.send('requestSeatSwap', { toSeat: 3 });
    await room.waitForNextPatch();
    expect(room.state.pendingSeatSwap).toBeUndefined();

    first.send('requestSeatSwap', { toSeat: 0 });
    await room.waitForNextPatch();
    expect(room.state.pendingSeatSwap).toBeUndefined();
  });

  it('refuses a swap once the cards are out', async () => {
    const { room, clients } = await seatFour();
    clients[0].send('startGame');
    await room.waitForNextPatch();

    clients[0].send('requestSeatSwap', { toSeat: 2 });
    await room.waitForNextPatch();

    expect(room.state.pendingSeatSwap).toBeUndefined();
  });
});

describe('disconnection', () => {
  it('marks a dropped player disconnected but holds their seat and name', async () => {
    const { room, clients } = await seatFour();

    await clients[1].leave(false); // false = not consented, i.e. a dropped connection
    await room.waitForNextPatch();

    expect(room.state.players[1].connected).toBe(false);
    expect(room.state.players[1].name).toBe('Bo');
    expect(room.state.players[1].sessionId).toBe(clients[1].sessionId);
  });

  it('does not vacate the seat for someone else to take', async () => {
    const { room, clients } = await seatFour();
    await clients[1].leave(false);
    await room.waitForNextPatch();

    await expect(colyseus.connectTo(room, { name: 'Ed' })).rejects.toBeTruthy();
    expect(room.state.players[1].name).toBe('Bo');
  });
});

describe('rematch vote', () => {
  /** Drives the table to matchComplete without playing 1165 points of cards. */
  async function reachMatchComplete() {
    const { room, clients } = await seatFour();
    clients[0].send('startGame');
    await room.waitForNextPatch();
    room.state.phase = 'matchComplete';
    room.state.team0Score = 1200;
    await room.waitForNextPatch();
    return { room, clients };
  }

  it('waits for all four players before restarting', async () => {
    const { room, clients } = await reachMatchComplete();

    clients[0].send('playAgain');
    clients[1].send('playAgain');
    clients[2].send('playAgain');
    await room.waitForNextPatch();

    expect(room.state.phase).toBe('matchComplete');

    clients[3].send('playAgain');
    await room.waitForNextPatch();

    expect(room.state.phase).toBe('configuring');
  });

  it('clears the scores and hands the settings to a newly drawn host', async () => {
    const { room, clients } = await reachMatchComplete();
    for (const client of clients) client.send('playAgain');
    await room.waitForNextPatch();

    expect(room.state.team0Score).toBe(0);
    expect(room.state.team1Score).toBe(0);
    expect(room.state.handNumber).toBe(0);
    expect(room.state.handHistory.length).toBe(0);
    expect(room.state.players.every((p) => !p.wantsRematch)).toBe(true);
    // Drawn at random from the seated players — which player doesn't matter, only
    // that it is one of them and that the role was actually re-decided.
    expect(clients.map((c) => c.sessionId)).toContain(room.state.hostSessionId);
  });

  it('keeps everyone in the seat they were already sitting in', async () => {
    const { room, clients } = await reachMatchComplete();
    for (const client of clients) client.send('playAgain');
    await room.waitForNextPatch();

    expect(room.state.players.map((p) => p.name)).toEqual(['Ann', 'Bo', 'Cy', 'Di']);
  });
});

describe('table settings', () => {
  it('refuses to create a table whose rules do not validate', async () => {
    await expect(colyseus.createRoom('shelem', { config: { targetScore: 3 } })).rejects.toBeTruthy();
  });

  it('keeps the rules the creator chose', async () => {
    const room = await colyseus.createRoom('shelem', { config: { targetScore: 330 } });
    expect(room.state.config.targetScore).toBe(330);
  });

  it('only lets the host set the rules, and only while configuring', async () => {
    const { room, clients } = await seatFour();

    // Lobby phase: even the host is too late, the rules were settled at create time.
    clients[0].send('setTableConfig', { targetScore: 330 });
    await room.waitForNextPatch();
    expect(room.state.config.targetScore).toBe(1165);

    room.state.phase = 'configuring';
    await room.waitForNextPatch();

    clients[1].send('setTableConfig', { targetScore: 330 });
    await room.waitForNextPatch();
    expect(room.state.config.targetScore).toBe(1165);
    expect(room.state.phase).toBe('configuring');

    clients[0].send('setTableConfig', { targetScore: 330 });
    await room.waitForNextPatch();
    expect(room.state.config.targetScore).toBe(330);
    expect(room.state.phase).toBe('lobby');
  });
});
