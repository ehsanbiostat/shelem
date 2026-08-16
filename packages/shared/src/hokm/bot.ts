import type { Card, Rank, Seat, Suit, Team } from '../core/types.js';
import { RANKS, SUITS, rankIndex } from '../core/deck.js';
import { determineTrickWinner, legalCards, type TrickCardPlay } from '../core/trick.js';

/**
 * A Hokm bot, as roughly twenty rules over what the seat legitimately knows.
 *
 * There is no search here and that is the design, not a shortcut. The strong
 * method for trick-taking games is Perfect Information Monte Carlo — sample the
 * opponents' hands, solve each sampled world exactly, vote — and it is far too
 * expensive for this server: an optimised C++ double-dummy solve of one deal is
 * ~50ms, and PIMC wants ~20 of them per move. Every Colyseus room shares one Node
 * event loop on half a vCPU, so a bot that thought for 200ms would not slow its
 * own table, it would freeze every table on the process.
 *
 * Rules are not the poor relation they sound. In a published Hearts comparison a
 * hand-coded agent of about twenty rules beat the alternatives outright. At the
 * strength people actually want to play against, this is the right tool, and it
 * costs microseconds.
 *
 * Everything here is a pure function of a `BotView`, so it is deterministic,
 * trivially unit-testable, and provably free of anything that could block.
 */

/** Points used to rate a suit when choosing trump. Not card values — Hokm has
 * none — just a way of saying an ace is worth more than a nine. */
const HONOUR_VALUE: Partial<Record<Rank, number>> = { A: 3, K: 2, Q: 1 };

/** A card's weight when picking trump: its length contribution is counted
 * separately, so this is only the "is it a winner" part. */
function honourValue(card: Card): number {
  return HONOUR_VALUE[card.rank] ?? 0;
}

/**
 * The trump suit to declare, given the Hâkem's opening five.
 *
 * Length first, honours second — a five-card suit of rubbish is worth more than
 * two aces in different suits, because trump length is what wins tricks by
 * ruffing. Scored as `length × 2 + honours` so a card of length outranks a queen
 * but not an ace.
 *
 * On five cards there is very little a search could add: the hand is small, the
 * other 47 cards are unknown, and the right answer is nearly always "the suit I
 * have most of".
 */
export function chooseTrump(hand: Card[]): Suit {
  if (hand.length === 0) throw new Error('chooseTrump needs at least one card');

  let best: Suit = SUITS[0];
  let bestScore = -Infinity;
  for (const suit of SUITS) {
    const cards = hand.filter((c) => c.suit === suit);
    const score = cards.length * 2 + cards.reduce((sum, c) => sum + honourValue(c), 0);
    if (score > bestScore) {
      bestScore = score;
      best = suit;
    }
  }
  return best;
}

/** Everything the seat is entitled to know when choosing a card. Deliberately
 * only that — a bot reasoning about cards it cannot see would be cheating. */
export interface BotView {
  seat: Seat;
  hand: Card[];
  /** The trick so far, in play order. Empty when this seat is leading. */
  trick: TrickCardPlay[];
  trumpSuit: Suit;
  /** Which team each seat plays for. Read rather than derived, because a Hokm
   * table can draw its partnerships from the cards. */
  teamOfSeat: readonly Team[];
  /** Every card played so far this hand, including the trick in progress. Public
   * information — the whole table watched each one land. */
  played: TrickCardPlay[];
}

function partnerOf(view: BotView, seat: Seat): Seat {
  const team = view.teamOfSeat[seat];
  return [0, 1, 2, 3].find((s) => s !== seat && view.teamOfSeat[s] === team) as Seat;
}

function bySuit(cards: Card[], suit: Suit): Card[] {
  return cards.filter((c) => c.suit === suit);
}

function lowest(cards: Card[]): Card {
  return cards.reduce((low, c) => (rankIndex(c.rank) < rankIndex(low.rank) ? c : low));
}

function highest(cards: Card[]): Card {
  return cards.reduce((high, c) => (rankIndex(c.rank) > rankIndex(high.rank) ? c : high));
}

/**
 * Which seats are known to hold no cards of a suit.
 *
 * A player who failed to follow a suit is void in it, permanently. This is the
 * one piece of memory worth keeping: it costs a pass over the played cards and it
 * sharpens both "is my winner safe" and "will this get ruffed" far more than
 * anything else available without a search.
 */
export function knownVoids(view: BotView): Record<Suit, Set<Seat>> {
  const voids = { spades: new Set<Seat>(), hearts: new Set<Seat>(), diamonds: new Set<Seat>(), clubs: new Set<Seat>() };

  // Walk the played cards in tricks of four; a card off-suit from the lead means
  // that seat had none of the led suit.
  for (let i = 0; i < view.played.length; i += 4) {
    const trick = view.played.slice(i, i + 4);
    if (trick.length === 0) continue;
    const led = trick[0].card.suit;
    for (const play of trick.slice(1)) {
      if (play.card.suit !== led) voids[led].add(play.seat);
    }
  }
  return voids;
}

/** Cards of a suit that nobody has played yet and this seat doesn't hold — i.e.
 * still out there, somewhere in the other three hands. */
function outstanding(view: BotView, suit: Suit): Card[] {
  const seen = new Set(
    [...view.played.map((p) => p.card), ...view.hand].filter((c) => c.suit === suit).map((c) => c.rank),
  );
  return RANKS.filter((r) => !seen.has(r)).map((rank) => ({ suit, rank }));
}

/** True if this card currently beats everything else out in its suit — a winner
 * if it isn't ruffed. */
function isTopOfSuit(view: BotView, card: Card): boolean {
  const above = outstanding(view, card.suit).filter((c) => rankIndex(c.rank) > rankIndex(card.rank));
  return above.length === 0;
}

/** Who is winning the trick as it stands. */
function currentWinner(view: BotView): TrickCardPlay | null {
  if (view.trick.length === 0) return null;
  const seat = determineTrickWinner(view.trick, view.trumpSuit);
  return view.trick.find((p) => p.seat === seat) ?? null;
}

/**
 * The card to play.
 *
 * Legality is not decided here: `legalCards` from core/trick.ts is the single
 * source of truth for what may be played, the same function the server enforces
 * and the client greys cards out with. This only chooses among cards that are
 * already legal, so a bot can never be the thing that plays an illegal card.
 */
export function chooseCard(view: BotView, rng: () => number = Math.random): Card {
  const leadSuit = view.trick.length > 0 ? view.trick[0].card.suit : null;
  const legal = legalCards(view.hand, leadSuit, view.trumpSuit);
  if (legal.length === 0) throw new Error('chooseCard called with no legal cards');
  if (legal.length === 1) return legal[0];

  return leadSuit === null ? chooseLead(view, legal, rng) : chooseFollow(view, legal, leadSuit);
}

/** Leading. Nobody has committed anything, so this is about making tricks
 * happen rather than reacting. */
function chooseLead(view: BotView, legal: Card[], rng: () => number): Card {
  const trumps = bySuit(legal, view.trumpSuit);
  const sideCards = legal.filter((c) => c.suit !== view.trumpSuit);
  const voids = knownVoids(view);

  // 1. Draw trumps while I am long in them and opponents still hold some. Getting
  //    their trumps out is what makes my side suits safe later.
  const trumpsOut = outstanding(view, view.trumpSuit);
  if (trumps.length >= 4 && trumpsOut.length > 0) {
    return highest(trumps);
  }

  // 2. Cash a side suit I hold the top card of — but only where no opponent is
  //    known to be void, since a void means it gets ruffed rather than won.
  const partner = partnerOf(view, view.seat);
  const opponents = ([0, 1, 2, 3] as Seat[]).filter((s) => s !== view.seat && s !== partner);
  const safeWinners = sideCards.filter(
    (c) => isTopOfSuit(view, c) && !opponents.some((o) => voids[c.suit].has(o)),
  );
  if (safeWinners.length > 0) return highest(safeWinners);

  // 3. Otherwise lead low from my longest side suit — cheap, and length is what
  //    eventually makes small cards good.
  if (sideCards.length > 0) {
    const longest = SUITS.filter((s) => s !== view.trumpSuit)
      .map((s) => bySuit(sideCards, s))
      .filter((cards) => cards.length > 0)
      .sort((a, b) => b.length - a.length)[0];
    return lowest(longest);
  }

  // 4. Nothing but trumps left.
  return rng() < 0.5 ? highest(trumps) : lowest(trumps);
}

/** Following. Somebody is already winning, which makes this a question about
 * whether to take the trick, and how cheaply. */
function chooseFollow(view: BotView, legal: Card[], leadSuit: Suit): Card {
  const winner = currentWinner(view);
  const partner = partnerOf(view, view.seat);
  const partnerWinning = winner !== null && winner.seat === partner;

  const followers = bySuit(legal, leadSuit);

  if (followers.length > 0) {
    // 5. Partner is taking it — duck. Overtaking my own side wins nothing and
    //    spends a card that could take a trick of its own later. This holds
    //    whether or not players remain: if someone behind me can beat them, my
    //    high card would probably have lost to that same player anyway.
    if (partnerWinning) return lowest(followers);

    // 6. Win it, with the cheapest card that does — spending an ace to beat a
    //    seven is how a hand runs out of winners.
    const beating = winner ? followers.filter((c) => beats(c, winner.card, leadSuit, view.trumpSuit)) : followers;
    if (beating.length > 0) return lowest(beating);

    // 7. Can't win: throw the cheapest thing I have in the suit.
    return lowest(followers);
  }

  // Void in the led suit.
  const trumps = bySuit(legal, view.trumpSuit);
  const discards = legal.filter((c) => c.suit !== view.trumpSuit);

  // 8. Partner is taking it already — don't spend a trump on my own side's trick.
  if (partnerWinning) {
    return discards.length > 0 ? lowest(worstSuit(discards)) : lowest(trumps);
  }

  // 9. An opponent has it. Ruff, as cheaply as still wins.
  if (trumps.length > 0 && winner) {
    const winning = trumps.filter((c) => beats(c, winner.card, leadSuit, view.trumpSuit));
    if (winning.length > 0) return lowest(winning);
  }

  // 10. Can't or shouldn't ruff — discard from my weakest suit, keeping length
  //     where I might still make something of it.
  return discards.length > 0 ? lowest(worstSuit(discards)) : lowest(trumps);
}

/** Does `card` beat `against`, given what was led and what is trump? */
function beats(card: Card, against: Card, leadSuit: Suit, trumpSuit: Suit): boolean {
  const cardTrump = card.suit === trumpSuit;
  const againstTrump = against.suit === trumpSuit;
  if (cardTrump !== againstTrump) return cardTrump;
  if (card.suit !== against.suit) return card.suit === leadSuit && against.suit !== leadSuit;
  return rankIndex(card.rank) > rankIndex(against.rank);
}

/** The suit worth abandoning: shortest first, and among equals the one with the
 * least in it. Keeping length is what turns small cards into winners later. */
function worstSuit(cards: Card[]): Card[] {
  const groups = SUITS.map((s) => bySuit(cards, s)).filter((g) => g.length > 0);
  return groups.sort(
    (a, b) =>
      a.length - b.length ||
      a.reduce((sum, c) => sum + honourValue(c), 0) - b.reduce((sum, c) => sum + honourValue(c), 0),
  )[0];
}
