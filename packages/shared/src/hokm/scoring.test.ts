import { describe, expect, it } from 'vitest';
import { DEFAULT_HOKM_CONFIG } from './config.js';
import { HOKM_TRICKS_TO_WIN, isHokmMatchComplete, nextHakemSeat, resolveHokmHand } from './scoring.js';

const rules = DEFAULT_HOKM_CONFIG;

describe('resolveHokmHand', () => {
  it('scores a won hand to the winners and nothing to the losers', () => {
    const result = resolveHokmHand({ team0Tricks: 7, team1Tricks: 4, hakemTeam: 0 }, rules);

    expect(result.outcome).toBe('normal');
    expect(result.winningTeam).toBe(0);
    expect(result.team0Delta).toBe(1);
    expect(result.team1Delta).toBe(0);
  });

  it('scores a Kot when the Hâkem’s team takes the first seven and the opponents none', () => {
    const result = resolveHokmHand({ team0Tricks: 7, team1Tricks: 0, hakemTeam: 0 }, rules);

    expect(result.outcome).toBe('kot');
    expect(result.team0Delta).toBe(2);
  });

  it('scores a Hâkem Koti when the opponents sweep the Hâkem instead', () => {
    const result = resolveHokmHand({ team0Tricks: 0, team1Tricks: 7, hakemTeam: 0 }, rules);

    expect(result.outcome).toBe('hakemKoti');
    expect(result.winningTeam).toBe(1);
    expect(result.team1Delta).toBe(3);
    expect(result.team0Delta).toBe(0);
  });

  it('does not treat a 7-1 finish as a sweep', () => {
    // One trick is all it takes to turn the dearest result on the table into the
    // cheapest, which is why the test is the losers' count and nothing else.
    const result = resolveHokmHand({ team0Tricks: 7, team1Tricks: 1, hakemTeam: 0 }, rules);

    expect(result.outcome).toBe('normal');
    expect(result.team0Delta).toBe(1);
  });

  it('reads the sweep against the Hâkem’s team, not against a fixed seat', () => {
    // Same 7-0 scoreline, opposite Hâkem: a Kot one way, a Hâkem Koti the other.
    expect(resolveHokmHand({ team0Tricks: 7, team1Tricks: 0, hakemTeam: 0 }, rules).outcome).toBe('kot');
    expect(resolveHokmHand({ team0Tricks: 7, team1Tricks: 0, hakemTeam: 1 }, rules).outcome).toBe('hakemKoti');
  });

  it('pays what the table priced each result at, not the traditional values', () => {
    const house = { handValue: 2, kotValue: 5, hakemKotiValue: 11 };

    expect(resolveHokmHand({ team0Tricks: 7, team1Tricks: 3, hakemTeam: 0 }, house).team0Delta).toBe(2);
    expect(resolveHokmHand({ team0Tricks: 7, team1Tricks: 0, hakemTeam: 0 }, house).team0Delta).toBe(5);
    expect(resolveHokmHand({ team0Tricks: 7, team1Tricks: 0, hakemTeam: 1 }, house).team0Delta).toBe(11);
  });

  it('still resolves when a team ran past seven', () => {
    // Nothing in the engine plays on past the seventh trick, but a hand tallied at
    // 13-0 is still a sweep and shouldn't fall over.
    const result = resolveHokmHand({ team0Tricks: 13, team1Tricks: 0, hakemTeam: 0 }, rules);
    expect(result.outcome).toBe('kot');
  });

  it('refuses to score a hand nobody has won yet', () => {
    expect(() => resolveHokmHand({ team0Tricks: 6, team1Tricks: 6, hakemTeam: 0 }, rules)).toThrow(/not over/);
  });

  it('needs seven tricks, not six', () => {
    expect(HOKM_TRICKS_TO_WIN).toBe(7);
    expect(() => resolveHokmHand({ team0Tricks: 6, team1Tricks: 0, hakemTeam: 0 }, rules)).toThrow();
  });
});

describe('nextHakemSeat', () => {
  it('leaves the Hâkem in the chair when their team wins the hand', () => {
    expect(nextHakemSeat(2, true)).toBe(2);
  });

  it('passes the chair on when their team loses', () => {
    expect(nextHakemSeat(2, false)).toBe(3);
  });

  it('wraps round the table', () => {
    expect(nextHakemSeat(3, false)).toBe(0);
  });
});

describe('isHokmMatchComplete', () => {
  it('is complete once either team reaches the target', () => {
    expect(isHokmMatchComplete({ team0: 7, team1: 3 }, 7)).toBe(true);
    expect(isHokmMatchComplete({ team0: 3, team1: 7 }, 7)).toBe(true);
  });

  it('is not complete while both are short', () => {
    expect(isHokmMatchComplete({ team0: 6, team1: 6 }, 7)).toBe(false);
  });

  it('respects a target the table shortened', () => {
    expect(isHokmMatchComplete({ team0: 3, team1: 1 }, 3)).toBe(true);
    expect(isHokmMatchComplete({ team0: 3, team1: 1 }, 5)).toBe(false);
  });
});
