import { boot, type ColyseusTestServer } from '@colyseus/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Card } from '@shelem/shared';
import appConfig from '../app.config.js';
import type { HokmRoom } from './HokmRoom.js';

/**
 * The Hokm hand, end to end: finding the Hâkem, naming trump off five cards,
 * playing tricks, and the three ways a hand can be scored.
 *
 * Hands are dealt from a real shuffled deck, so the tests drive play by asking the
 * room what each seat is holding rather than by fixing the deal — `handOf` reaches
 * into the room's private hands, which is the one thing a client can never do and
 * the reason these assertions have to live server-side.
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

/** The private hand for a seat. Deliberately a reach past the public API — see above. */
function handOf(room: HokmRoom, seat: number): Card[] {
  return (room as unknown as { hands: Card[][] }).hands[seat];
}

/**
 * Waits for the room to reach a phase. The Hâkem draw runs on a timer of unknown
 * length — a 52-card deck holds four Aces, so how many cards turn up before one
 * does is luck — so a fixed sleep here would pass or fail on the shuffle.
 */
async function waitForPhase(room: HokmRoom, phase: string, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (room.state.phase !== phase) {
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for phase '${phase}', still in '${room.state.phase}'`);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

async function seatFour(config: Record<string, unknown> = { hakemSelection: 'random' }) {
  const room = await colyseus.createRoom<HokmRoom>('hokm', { config });
  const clients = [];
  for (const name of ['Ann', 'Bo', 'Cy', 'Di']) {
    clients.push(await colyseus.connectTo(room, { name }));
  }
  return { room, clients };
}

/** Seats four, starts the hand, and names trump — leaving the table mid-play with
 * the Hâkem on lead. */
async function startPlaying(config: Record<string, unknown> = { hakemSelection: 'random' }) {
  const { room, clients } = await seatFour(config);
  clients[0].send('startGame');
  await room.waitForNextPatch();

  const hakem = room.state.hakemSeat;
  clients[hakem].send('declareTrump', { suit: 'spades' });
  await room.waitForNextPatch();

  return { room, clients, hakem };
}

/** Plays one full trick, each seat following suit where it can. Returns the seat
 * that won it. */
async function playTrick(
  room: HokmRoom,
  clients: Awaited<ReturnType<typeof seatFour>>['clients'],
  pick: (hand: Card[], leadSuit: string | null, seat: number) => Card,
) {
  for (let i = 0; i < 4; i++) {
    const seat = room.state.currentTurnSeat;
    const leadSuit = room.state.currentTrick.length > 0 ? room.state.currentTrick[0].suit : null;
    const card = pick(handOf(room, seat), leadSuit, seat);
    clients[seat].send('playCard', { suit: card.suit, rank: card.rank });
    await room.waitForNextPatch();
  }
  // The room holds the completed trick on screen for 1.5s before resolving it.
  await new Promise((resolve) => setTimeout(resolve, 1700));
  return room.state.lastTrickWinnerSeat;
}

/** Follows suit when possible, otherwise throws the lowest thing available. */
const followSuit = (hand: Card[], leadSuit: string | null): Card =>
  hand.find((c) => c.suit === leadSuit) ?? hand[hand.length - 1];

describe('finding the Hâkem', () => {
  it('seats a Hâkem and deals five cards each before trump is named', async () => {
    const { room, clients } = await seatFour();
    clients[0].send('startGame');
    await room.waitForNextPatch();

    expect(room.state.phase).toBe('declaringTrump');
    expect(room.state.hakemSeat).toBeGreaterThanOrEqual(0);
    expect(room.state.players.map((p) => p.handSize)).toEqual([5, 5, 5, 5]);
    expect(room.state.currentTurnSeat).toBe(room.state.hakemSeat);
  });

  it('turns no cards face up on a table that skips the ceremony', async () => {
    const { room, clients } = await seatFour({ hakemSelection: 'random' });
    clients[0].send('startGame');
    await room.waitForNextPatch();

    expect(room.state.hakemDraw.length).toBe(0);
  });

  it('deals cards face up until an Ace finds the Hâkem', async () => {
    const { room, clients } = await seatFour({ hakemSelection: 'aceDealSeats' });
    clients[0].send('startGame');
    await room.waitForNextPatch();

    expect(room.state.phase).toBe('hakemDraw');

    // The reveals land on a timer so the table watches the draw rather than being
    // handed its result.
    await waitForPhase(room, 'declaringTrump');

    expect(room.state.hakemDraw.length).toBeGreaterThan(0);
    const last = room.state.hakemDraw[room.state.hakemDraw.length - 1];
    expect(last.rank).toBe('A');
    expect(last.seat).toBe(room.state.hakemSeat);
  });

  it('turns up exactly one Ace, and stops there, when partnerships are by seat', async () => {
    const { room, clients } = await seatFour({ hakemSelection: 'aceDealSeats' });
    clients[0].send('startGame');
    await room.waitForNextPatch();
    await waitForPhase(room, 'declaringTrump');

    expect(room.state.hakemDraw.filter((r) => r.rank === 'A')).toHaveLength(1);
  });

  it('leaves partnerships on seat parity when the ceremony only seats the Hâkem', async () => {
    const { room, clients } = await seatFour({ hakemSelection: 'aceDealSeats' });
    clients[0].send('startGame');
    await room.waitForNextPatch();
    await waitForPhase(room, 'declaringTrump');

    expect([...room.state.teamOfSeat]).toEqual([0, 1, 0, 1]);
  });

  it('seats the Hâkem and their partner opposite each other', async () => {
    // The bug this replaces: the two Ace-holders were made partners *where they
    // sat*, so an adjacent pair stayed adjacent. The old test only checked they
    // shared a team, which the bug satisfied perfectly.
    //
    // Retried across tables because the draw is random and the already-opposite
    // case passes either way — only a non-parity draw can tell the two apart.
    for (let attempt = 0; attempt < 20; attempt++) {
      const { room, clients } = await seatFour({ hakemSelection: 'aceDealTeams' });
      clients[0].send('startGame');
      await room.waitForNextPatch();

      await waitForPhase(room, 'declaringTrump');

      // By name, not by seat — the reseat moves people, and the whole point of
      // capturing a name on each reveal is that a seat lookup would now be wrong.
      const aces = room.state.hakemDraw.filter((r) => r.rank === 'A');
      const hakemName = aces[0].name;
      const partnerName = aces[aces.length - 1].name;
      if (partnerName === hakemName) throw new Error('the Hâkem cannot be their own partner');

      const seatOfName = (name: string) => room.state.players.findIndex((p) => p.name === name);
      const hakemSeat = seatOfName(hakemName);
      const partnerSeat = seatOfName(partnerName);

      // The Hâkem never moves, so this also checks the reseat kept hakemSeat valid.
      expect(hakemSeat).toBe(room.state.hakemSeat);
      expect(partnerSeat).toBe((hakemSeat + 2) % 4);
      expect([...room.state.teamOfSeat]).toEqual([0, 1, 0, 1]);

      // Only a draw that actually had to move somebody proves the fix; keep going
      // until one turns up.
      if (room.state.swappedSeatA >= 0) {
        expect(room.state.swappedSeatB).toBeGreaterThanOrEqual(0);
        return;
      }
      await colyseus.cleanup();
    }
    throw new Error('never drew an Ace pair that needed reseating');
  });

  it('moves nobody when the Aces already landed opposite each other', async () => {
    for (let attempt = 0; attempt < 20; attempt++) {
      const { room, clients } = await seatFour({ hakemSelection: 'aceDealTeams' });
      clients[0].send('startGame');
      await room.waitForNextPatch();
      await waitForPhase(room, 'declaringTrump');

      if (room.state.swappedSeatA === -1) {
        // Nothing announced, and the seating is untouched.
        expect(room.state.swappedSeatB).toBe(-1);
        expect(room.state.players.map((p) => p.name)).toEqual(['Ann', 'Bo', 'Cy', 'Di']);
        return;
      }
      await colyseus.cleanup();
    }
    throw new Error('never drew an Ace pair that was already opposite');
  });
});

describe('naming trump', () => {
  it('deals the remaining eight only once the Hâkem has chosen', async () => {
    const { room, clients } = await seatFour();
    clients[0].send('startGame');
    await room.waitForNextPatch();

    const hakem = room.state.hakemSeat;
    expect(room.state.players.map((p) => p.handSize)).toEqual([5, 5, 5, 5]);

    clients[hakem].send('declareTrump', { suit: 'hearts' });
    await room.waitForNextPatch();

    expect(room.state.trumpSuit).toBe('hearts');
    expect(room.state.players.map((p) => p.handSize)).toEqual([13, 13, 13, 13]);
    expect(room.state.phase).toBe('playing');
  });

  it('gives the lead to the Hâkem', async () => {
    const { room, hakem } = await startPlaying();
    expect(room.state.currentTurnSeat).toBe(hakem);
  });

  it('ignores anyone but the Hâkem trying to name trump', async () => {
    const { room, clients } = await seatFour();
    clients[0].send('startGame');
    await room.waitForNextPatch();

    const notHakem = (room.state.hakemSeat + 1) % 4;
    clients[notHakem].send('declareTrump', { suit: 'clubs' });
    await room.waitForNextPatch();

    expect(room.state.trumpSuit).toBe('');
    expect(room.state.phase).toBe('declaringTrump');
  });

  it('refuses anything that is not one of the four suits', async () => {
    const { room, clients } = await seatFour();
    clients[0].send('startGame');
    await room.waitForNextPatch();

    clients[room.state.hakemSeat].send('declareTrump', { suit: 'swords' });
    await room.waitForNextPatch();

    expect(room.state.trumpSuit).toBe('');
    expect(room.state.phase).toBe('declaringTrump');
  });

  it('keeps the eight undealt cards out of every hand until then', async () => {
    // The Hâkem chooses knowing five cards. If the rest had already been merged,
    // the choice would be made on thirteen and the game would be a different one.
    const { room, clients } = await seatFour();
    clients[0].send('startGame');
    await room.waitForNextPatch();

    for (let seat = 0; seat < 4; seat++) {
      expect(handOf(room, seat)).toHaveLength(5);
    }
  });
});

describe('playing tricks', () => {
  it('counts the trick to the winning team and gives them the lead', async () => {
    const { room, clients } = await startPlaying();

    const winner = await playTrick(room, clients, followSuit);

    expect(room.state.team0Tricks + room.state.team1Tricks).toBe(1);
    expect(room.state.currentTurnSeat).toBe(winner);
    expect(room.state.lastTrick.length).toBe(4);
  });

  it('holds a player to the suit that was led', async () => {
    const { room, clients } = await startPlaying();

    const leader = room.state.currentTurnSeat;
    const led = handOf(room, leader)[0];
    clients[leader].send('playCard', { suit: led.suit, rank: led.rank });
    await room.waitForNextPatch();

    const next = room.state.currentTurnSeat;
    const offSuit = handOf(room, next).find((c) => c.suit !== led.suit);
    const canFollow = handOf(room, next).some((c) => c.suit === led.suit);
    if (!canFollow || !offSuit) return; // nothing to prove on this deal

    clients[next].send('playCard', { suit: offSuit.suit, rank: offSuit.rank });
    await room.waitForNextPatch();

    expect(room.state.currentTrick.length).toBe(1);
    expect(room.state.currentTurnSeat).toBe(next);
  });

  it('refuses a card the player is not holding', async () => {
    const { room, clients } = await startPlaying();
    const leader = room.state.currentTurnSeat;
    const notHeld = handOf(room, leader)[0];

    // Same card, but played from the seat that isn't holding it.
    const other = (leader + 1) % 4;
    clients[other].send('playCard', { suit: notHeld.suit, rank: notHeld.rank });
    await room.waitForNextPatch();

    expect(room.state.currentTrick.length).toBe(0);
  });

  it('never puts a hand into synced state — only its size', async () => {
    const { room } = await startPlaying();
    const synced = JSON.stringify(room.state.toJSON());

    // A hand holds 13 cards; the public state should carry the count and nothing else.
    expect(room.state.players.every((p) => p.handSize === 13)).toBe(true);
    expect(synced).not.toContain('"hands"');
  });
});

describe('scoring a hand', () => {
  /** Forces a finished hand at the given trick split and lets the room score it. */
  async function scoreHand(team0Tricks: number, team1Tricks: number, hakemTeam: 0 | 1) {
    const { room, clients } = await startPlaying();
    room.state.hakemSeat = hakemTeam; // seats 0 and 1 are on teams 0 and 1 respectively
    room.state.team0Tricks = team0Tricks;
    room.state.team1Tricks = team1Tricks;
    (room as unknown as { completeHand: () => void }).completeHand();
    await room.waitForNextPatch();
    return { room, clients };
  }

  it('scores one point for a hand won with the losers on the board', async () => {
    const { room } = await scoreHand(7, 3, 0);

    expect(room.state.team0Score).toBe(1);
    expect(room.state.team1Score).toBe(0);
    expect(room.state.handHistory[0].outcome).toBe('normal');
  });

  it('scores two for a Kot — the Hâkem’s team sweeping', async () => {
    const { room } = await scoreHand(7, 0, 0);

    expect(room.state.team0Score).toBe(2);
    expect(room.state.handHistory[0].outcome).toBe('kot');
  });

  it('scores three when the opponents sweep the Hâkem instead', async () => {
    const { room } = await scoreHand(0, 7, 0);

    expect(room.state.team1Score).toBe(3);
    expect(room.state.handHistory[0].outcome).toBe('hakemKoti');
  });

  it('treats a single trick as enough to avoid the sweep', async () => {
    const { room } = await scoreHand(7, 1, 0);

    expect(room.state.team0Score).toBe(1);
    expect(room.state.handHistory[0].outcome).toBe('normal');
  });

  it('records the hand so the scoreboard can show how the match got here', async () => {
    const { room } = await scoreHand(7, 2, 0);
    const row = room.state.handHistory[0];

    expect(row.trumpSuit).toBe('spades');
    expect(row.team0Tricks).toBe(7);
    expect(row.team1Tricks).toBe(2);
    expect(row.team0Total).toBe(room.state.team0Score);
  });
});

describe('the Hâkem’s chair', () => {
  async function completeWith(team0Tricks: number, team1Tricks: number) {
    const { room, clients } = await startPlaying();
    room.state.hakemSeat = 0;
    room.state.team0Tricks = team0Tricks;
    room.state.team1Tricks = team1Tricks;
    (room as unknown as { completeHand: () => void }).completeHand();
    await room.waitForNextPatch();
    return { room, clients };
  }

  it('stays with the Hâkem when their team wins the hand', async () => {
    const { room } = await completeWith(7, 2);
    expect(room.state.hakemSeat).toBe(0);
  });

  it('passes to the next seat when their team loses', async () => {
    const { room } = await completeWith(2, 7);
    expect(room.state.hakemSeat).toBe(1);
  });
});

describe('ending the match', () => {
  it('stops as soon as a team reaches the target', async () => {
    const { room, clients } = await seatFour({ hakemSelection: 'random', targetScore: 1 });
    clients[0].send('startGame');
    await room.waitForNextPatch();
    clients[room.state.hakemSeat].send('declareTrump', { suit: 'spades' });
    await room.waitForNextPatch();

    room.state.hakemSeat = 0;
    room.state.team0Tricks = 7;
    room.state.team1Tricks = 3;
    (room as unknown as { completeHand: () => void }).completeHand();
    await room.waitForNextPatch();

    expect(room.state.phase).toBe('matchComplete');
    expect(room.state.currentTurnSeat).toBe(-1);
  });
});

describe('table settings', () => {
  it('refuses a table whose scoring ladder is inverted', async () => {
    await expect(
      colyseus.createRoom('hokm', { config: { kotValue: 5, hakemKotiValue: 2 } }),
    ).rejects.toBeTruthy();
  });

  it('plays to the values the table chose', async () => {
    const room = await colyseus.createRoom<HokmRoom>('hokm', {
      config: { handValue: 2, kotValue: 5, hakemKotiValue: 11, targetScore: 20 },
    });

    expect(room.state.config.handValue).toBe(2);
    expect(room.state.config.kotValue).toBe(5);
    expect(room.state.config.hakemKotiValue).toBe(11);
  });

  it('starts every hand from a fresh deck by default', async () => {
    const room = await colyseus.createRoom<HokmRoom>('hokm', {});
    expect(room.state.config.shuffleMode).toBe('random');
  });
});
