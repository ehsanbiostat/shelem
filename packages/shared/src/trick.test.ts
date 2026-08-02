import { describe, expect, it } from 'vitest';
import { determineTrickWinner, legalCards } from './trick.js';

describe('determineTrickWinner', () => {
  it('highest card of the led suit wins when no trump is played', () => {
    const winner = determineTrickWinner(
      [
        { seat: 0, card: { suit: 'hearts', rank: '9' } },
        { seat: 1, card: { suit: 'hearts', rank: 'K' } },
        { seat: 2, card: { suit: 'clubs', rank: 'A' } }, // off-suit, can't win
        { seat: 3, card: { suit: 'hearts', rank: '2' } },
      ],
      'spades',
    );
    expect(winner).toBe(1);
  });

  it('any trump beats every non-trump card, even a low trump', () => {
    const winner = determineTrickWinner(
      [
        { seat: 0, card: { suit: 'hearts', rank: 'A' } },
        { seat: 1, card: { suit: 'spades', rank: '2' } }, // trump
        { seat: 2, card: { suit: 'hearts', rank: 'K' } },
        { seat: 3, card: { suit: 'hearts', rank: 'Q' } },
      ],
      'spades',
    );
    expect(winner).toBe(1);
  });

  it('highest trump wins when multiple trumps are played', () => {
    const winner = determineTrickWinner(
      [
        { seat: 0, card: { suit: 'spades', rank: '5' } },
        { seat: 1, card: { suit: 'spades', rank: 'J' } },
        { seat: 2, card: { suit: 'hearts', rank: 'A' } },
        { seat: 3, card: { suit: 'spades', rank: '9' } },
      ],
      'spades',
    );
    expect(winner).toBe(1);
  });
});

describe('legalCards', () => {
  it('any card is legal when leading', () => {
    const hand = [
      { suit: 'hearts', rank: '2' },
      { suit: 'spades', rank: 'A' },
    ] as const;
    expect(legalCards([...hand], null, 'clubs')).toHaveLength(2);
  });

  it('must follow suit if holding a card of the led suit', () => {
    const hand = [
      { suit: 'hearts', rank: '2' },
      { suit: 'hearts', rank: 'K' },
      { suit: 'spades', rank: 'A' },
    ] as const;
    const legal = legalCards([...hand], 'hearts', 'clubs');
    expect(legal).toEqual([
      { suit: 'hearts', rank: '2' },
      { suit: 'hearts', rank: 'K' },
    ]);
  });

  it('must play trump if void in the led suit and holding trump', () => {
    const hand = [
      { suit: 'spades', rank: '2' },
      { suit: 'clubs', rank: 'K' }, // trump
      { suit: 'diamonds', rank: 'A' },
    ] as const;
    const legal = legalCards([...hand], 'hearts', 'clubs');
    expect(legal).toEqual([{ suit: 'clubs', rank: 'K' }]);
  });

  it('any card is legal if void in both the led suit and trump', () => {
    const hand = [
      { suit: 'spades', rank: '2' },
      { suit: 'diamonds', rank: 'A' },
    ] as const;
    const legal = legalCards([...hand], 'hearts', 'clubs');
    expect(legal).toHaveLength(2);
  });
});
