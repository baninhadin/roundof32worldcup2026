import { describe, expect, it } from 'vitest';
import { eliminations } from './feasibility';
import type { Group, Match } from './types';

const m = (home: string, away: string, hg: number | null, ag: number | null): Match => ({
  home,
  away,
  homeGoals: hg,
  awayGoals: ag,
});

/** A finished group: t1 beats all (9), t2 beats t3+t4 (6), t3 beats t4 (3), t4 loses all (0). */
function finishedGroup(name: string): Group {
  const id = (n: number) => `${name}${n}`;
  return {
    name,
    teams: [1, 2, 3, 4].map((n) => ({ id: id(n), name: id(n) })),
    matches: [
      m(id(1), id(2), 1, 0),
      m(id(1), id(3), 1, 0),
      m(id(1), id(4), 1, 0),
      m(id(2), id(3), 1, 0),
      m(id(2), id(4), 1, 0),
      m(id(3), id(4), 1, 0),
    ],
  };
}

describe('elimination — example 1: lose all three is mathematically out', () => {
  it('marks a winless last-place team as eliminated (reason last)', () => {
    const elim = eliminations([finishedGroup('A')]);
    expect(elim.get('A4')).toBe('last'); // 0 points, finished 4th
    expect(elim.has('A1')).toBe(false); // winner
    expect(elim.has('A2')).toBe(false); // runner-up
  });
});

describe('finished group: 3rd vs 4th decided by real goal difference', () => {
  it('eliminates the 4th-placed team even when level on points and head-to-head', () => {
    // C and D both finish on 1 point and drew head-to-head, but C has the better
    // goal difference, so C is 3rd (alive) and D is 4th (out). The group is over,
    // so goal difference is real and must separate them.
    const group: Group = {
      name: 'Z',
      teams: ['A', 'B', 'C', 'D'].map((n) => ({ id: n, name: n })),
      matches: [
        m('A', 'B', 1, 0),
        m('A', 'C', 1, 0),
        m('A', 'D', 3, 0),
        m('B', 'C', 1, 0),
        m('B', 'D', 1, 0),
        m('C', 'D', 0, 0), // C and D level on 1 point, drew head-to-head; C has better GD
      ],
    };
    const elim = eliminations([group]);
    expect(elim.get('D')).toBe('last'); // 4th on goal difference -> out
    expect(elim.get('C')).not.toBe('last'); // 3rd -> still alive for a best-third spot
  });
});

describe('elimination — example 2: can finish 3rd but cannot reach the 8 best thirds', () => {
  it('eliminates a 3rd-placed team when 8 groups have stronger thirds', () => {
    // 8 "strong" finished groups: their 3rd-placed team has 3 points.
    const strong = ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'].map(finishedGroup);

    // Target group T: T3 finishes 3rd on just 1 point and cannot make the top 2.
    // T1 beats everyone (9), T2 beats T3+T4 (6), T3 draws T4 (1), T4 loses to all but draw (1).
    const target: Group = {
      name: 'T',
      teams: [1, 2, 3, 4].map((n) => ({ id: `T${n}`, name: `T${n}` })),
      matches: [
        m('T1', 'T2', 1, 0),
        m('T1', 'T3', 1, 0),
        m('T1', 'T4', 1, 0),
        m('T2', 'T3', 1, 0),
        m('T2', 'T4', 1, 0),
        m('T3', 'T4', 0, 0), // draw: T3 and T4 each on 1
      ],
    };

    const elim = eliminations([target, ...strong]);
    // T3 is a 3rd-placed team on 1 point; 8 groups have a 3rd on 3 points -> forced out of the 8.
    expect(elim.get('T3')).toBe('bestThird');
    // A strong group's 3rd (3 points) is NOT eliminated via best-third (only ~0 forced above it).
    expect(elim.get('C3')).not.toBe('bestThird');
    // Strong groups' winless 4th teams are out as last, which is correct.
    expect(elim.get('C4')).toBe('last');
  });
});
