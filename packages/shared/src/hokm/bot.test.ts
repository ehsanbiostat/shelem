import { describe, expect, it } from 'vitest';
import type { Card, Rank, Seat, Suit, Team } from '../core/types.js';
import { createDeck, shuffle } from '../core/deck.js';
import { determineTrickWinner, legalCards, type TrickCardPlay } from '../core/trick.js';
import { chooseCard, chooseTrump, knownVoids, type BotView } from './bot.js';
import { dealHokm } from './deal.js';
import { HOKM_TRICKS_TO_WIN } from './scoring.js';

/** `A♠ K♥ 3c` — a compact way to write a hand out. */
function hand(spec: string): Card[] {
  const suits: Record<string, Suit> = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' };
  return spec.split(' ').map((token) => ({
    rank: token.slice(0, -1) as Rank,
    suit: suits[token.slice(-1)],
  }));
}

const card = (spec: string): Card => hand(spec)[0];

/** Seats 0 & 2 against 1 & 3, the ordinary pairing. */
const SEATED: Team[] = [0, 1, 0, 1];

function view(partial: Partial<BotView> & Pick<BotView, 'hand'>): BotView {
  return {
    seat: 0,
    trick: [],
    trumpSuit: 'spades',
    teamOfSeat: SEATED,
    played: [],
    ...partial,
  };
}

describe('chooseTrump', () => {
  it('takes the longest suit', () => {
    expect(chooseTrump(hand('2d 5d 9d Jd Ah'))).toBe('diamonds');
  });

  it('prefers length over honours in another suit', () => {
    // Four rubbish clubs beat an ace-king doubleton: trump length is what makes
    // tricks by ruffing.
    expect(chooseTrump(hand('2c 4c 6c 8c Ah'))).toBe('clubs');
  });

  it('breaks a tie on length by honours', () => {
    expect(chooseTrump(hand('Ah Kh 2d 3d 9c'))).toBe('hearts');
  });

  it('takes the only suit it holds', () => {
    expect(chooseTrump(hand('2s 3s 4s 5s 6s'))).toBe('spades');
  });

  it('refuses an empty hand rather than picking arbitrarily', () => {
    expect(() => chooseTrump([])).toThrow();
  });
});

describe('knownVoids', () => {
  it('records a seat that failed to follow the led suit', () => {
    const played: TrickCardPlay[] = [
      { seat: 0, card: card('Ah') },
      { seat: 1, card: card('2h') },
      { seat: 2, card: card('3c') }, // off-suit: seat 2 has no hearts
      { seat: 3, card: card('5h') },
    ];
    const voids = knownVoids(view({ hand: [], played }));

    expect([...voids.hearts]).toEqual([2]);
    expect(voids.clubs.size).toBe(0);
  });

  it('does not accuse the leader of being void in their own lead', () => {
    const played: TrickCardPlay[] = [
      { seat: 0, card: card('Ah') },
      { seat: 1, card: card('2h') },
      { seat: 2, card: card('3h') },
      { seat: 3, card: card('5h') },
    ];
    expect(knownVoids(view({ hand: [], played })).hearts.size).toBe(0);
  });

  it('remembers a void from an earlier trick', () => {
    const played: TrickCardPlay[] = [
      { seat: 0, card: card('Ah') },
      { seat: 1, card: card('2c') },
      { seat: 2, card: card('3h') },
      { seat: 3, card: card('5h') },
      { seat: 0, card: card('Ad') },
      { seat: 1, card: card('2d') },
      { seat: 2, card: card('3d') },
      { seat: 3, card: card('5d') },
    ];
    expect([...knownVoids(view({ hand: [], played })).hearts]).toEqual([1]);
  });
});

describe('chooseCard — legality', () => {
  it('follows suit when it can', () => {
    const chosen = chooseCard(
      view({
        seat: 1,
        hand: hand('2h 9h Ac As'),
        trick: [{ seat: 0, card: card('5h') }],
      }),
    );
    expect(chosen.suit).toBe('hearts');
  });

  it('never returns a card outside the legal set, over many random positions', () => {
    // The bot chooses among legalCards() rather than deciding legality itself, so
    // this is really a guard against that ever being bypassed.
    const rng = seededRng(4);
    for (let trial = 0; trial < 400; trial++) {
      const { opening, rest } = dealHokm(shuffle(createDeck(), rng), 0);
      const myHand = [...opening[1], ...rest[1]];
      const lead = opening[0][0];
      const v = view({ seat: 1, hand: myHand, trick: [{ seat: 0, card: lead }], trumpSuit: 'spades' });
      const legal = legalCards(myHand, lead.suit, 'spades');
      const chosen = chooseCard(v, rng);
      expect(legal.some((c) => c.suit === chosen.suit && c.rank === chosen.rank)).toBe(true);
    }
  });

  it('plays its one card when only one is legal', () => {
    const chosen = chooseCard(view({ seat: 1, hand: hand('7h'), trick: [{ seat: 0, card: card('5h') }] }));
    expect(chosen).toEqual(card('7h'));
  });

  it('refuses a hand with nothing in it', () => {
    expect(() => chooseCard(view({ hand: [] }))).toThrow();
  });
});

describe('chooseCard — following', () => {
  it('wins with the cheapest card that beats the trick, not its best', () => {
    const chosen = chooseCard(
      view({
        seat: 1,
        hand: hand('8h Jh Ah'),
        trick: [{ seat: 0, card: card('7h') }],
      }),
    );
    expect(chosen).toEqual(card('8h'));
  });

  it('ducks when its partner is already winning', () => {
    // Seat 2 is seat 0's partner and is winning with the ace; seat 0 throws low
    // rather than overtaking its own side.
    const chosen = chooseCard(
      view({
        seat: 0,
        hand: hand('2h Kh'),
        trick: [
          { seat: 1, card: card('5h') },
          { seat: 2, card: card('Ah') },
        ],
      }),
    );
    expect(chosen).toEqual(card('2h'));
  });

  it('throws its cheapest card in the suit when it cannot win', () => {
    const chosen = chooseCard(
      view({
        seat: 1,
        hand: hand('2h 5h 9h'),
        trick: [{ seat: 0, card: card('Ah') }],
      }),
    );
    expect(chosen).toEqual(card('2h'));
  });

  it('ruffs when void and an opponent is winning', () => {
    const chosen = chooseCard(
      view({
        seat: 1,
        hand: hand('2s 9s 4d'),
        trick: [{ seat: 0, card: card('Ah') }],
        trumpSuit: 'spades',
      }),
    );
    expect(chosen).toEqual(card('2s'));
  });

  it('ruffs as cheaply as still wins', () => {
    const chosen = chooseCard(
      view({
        seat: 2,
        hand: hand('4s 9s Ks'),
        trick: [
          { seat: 0, card: card('Ah') },
          { seat: 1, card: card('6s') },
        ],
        trumpSuit: 'spades',
        teamOfSeat: [0, 1, 0, 1],
      }),
    );
    expect(chosen).toEqual(card('9s'));
  });

  it('does not spend a trump when its partner already has the trick', () => {
    const chosen = chooseCard(
      view({
        seat: 2,
        hand: hand('4s 2d 3c'),
        trick: [
          { seat: 3, card: card('5h') },
          { seat: 0, card: card('Ah') },
        ],
        trumpSuit: 'spades',
      }),
    );
    expect(chosen.suit).not.toBe('spades');
  });
});

describe('chooseCard — leading', () => {
  it('draws trumps while long in them', () => {
    const chosen = chooseCard(view({ seat: 0, hand: hand('2s 5s 9s Ks 3h'), trumpSuit: 'spades' }));
    expect(chosen).toEqual(card('Ks'));
  });

  it('cashes a side suit it holds the top card of', () => {
    // Two trumps only, so no drawing; the heart ace is the top heart out.
    const chosen = chooseCard(view({ seat: 0, hand: hand('2s 5s Ah 3d'), trumpSuit: 'spades' }));
    expect(chosen).toEqual(card('Ah'));
  });

  it('will not cash into a known void', () => {
    // Seat 1 showed out of hearts, so the ace gets ruffed rather than winning.
    const played: TrickCardPlay[] = [
      { seat: 0, card: card('Kh') },
      { seat: 1, card: card('2c') },
      { seat: 2, card: card('3h') },
      { seat: 3, card: card('5h') },
    ];
    const chosen = chooseCard(view({ seat: 0, hand: hand('2s 5s Ah 3d 4d'), trumpSuit: 'spades', played }));
    expect(chosen).not.toEqual(card('Ah'));
  });

  it('leads low from its longest side suit when it has nothing better', () => {
    const chosen = chooseCard(view({ seat: 0, hand: hand('2s 4d 7d 9d 3h'), trumpSuit: 'spades' }));
    expect(chosen).toEqual(card('4d'));
  });
});

describe('the bot as a whole', () => {
  /** Plays a complete hand with all four seats driven by the bot, and reports what
   * it cost. */
  function playBotHand(seed: number) {
    const rng = seededRng(seed);
    const { opening, rest } = dealHokm(shuffle(createDeck(), rng), 0);
    const hands: Card[][] = [0, 1, 2, 3].map((s) => [...opening[s], ...rest[s]]);
    const trumpSuit = chooseTrump(opening[0]);

    const played: TrickCardPlay[] = [];
    const tricks = [0, 0];
    let leader: Seat = 0;
    let decisions = 0;
    const started = performance.now();

    while (Math.max(tricks[0], tricks[1]) < HOKM_TRICKS_TO_WIN) {
      const trick: TrickCardPlay[] = [];
      for (let i = 0; i < 4; i++) {
        const seat = ((leader + i) % 4) as Seat;
        const chosen = chooseCard(
          { seat, hand: hands[seat], trick, trumpSuit, teamOfSeat: SEATED, played: [...played, ...trick] },
          rng,
        );
        const legal = legalCards(hands[seat], trick.length ? trick[0].card.suit : null, trumpSuit);
        if (!legal.some((c) => c.suit === chosen.suit && c.rank === chosen.rank)) {
          throw new Error(`illegal card from seat ${seat}: ${chosen.rank}${chosen.suit}`);
        }
        hands[seat] = hands[seat].filter((c) => !(c.suit === chosen.suit && c.rank === chosen.rank));
        trick.push({ seat, card: chosen });
        decisions++;
      }
      const winner = determineTrickWinner(trick, trumpSuit);
      tricks[SEATED[winner]]++;
      played.push(...trick);
      leader = winner;
    }

    return { elapsedMs: performance.now() - started, decisions, tricks, played };
  }

  it('plays a hand out to seven tricks without an illegal move', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { tricks } = playBotHand(seed);
      expect(Math.max(tricks[0], tricks[1])).toBe(HOKM_TRICKS_TO_WIN);
    }
  });

  it('never plays the same card twice in a hand', () => {
    const { played } = playBotHand(7);
    const keys = played.map((p) => `${p.card.suit}-${p.card.rank}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  /**
   * The whole design rests on bot decisions being far too cheap to matter: every
   * Colyseus room shares one Node event loop on half a vCPU, so a bot that thought
   * for even a few hundred milliseconds would stall every other table on the
   * server, not just its own.
   *
   * This is deliberately an assertion rather than a note, so that reaching for a
   * search later fails loudly here instead of quietly degrading every live table.
   * The bar is generous — roughly a hundred times the observed cost — so it flags
   * a change of approach, not ordinary timing noise on a busy CI box.
   */
  it('decides a full hand in well under a millisecond of CPU per move', () => {
    let total = 0;
    let decisions = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const run = playBotHand(seed);
      total += run.elapsedMs;
      decisions += run.decisions;
    }
    const perDecision = total / decisions;
    expect(perDecision).toBeLessThan(1);
    // And a whole hand, which is what a table actually waits on.
    expect(total / 20).toBeLessThan(20);
  });
});

/** mulberry32 — the same deterministic PRNG the deck tests use. */
function seededRng(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
