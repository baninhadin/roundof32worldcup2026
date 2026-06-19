import { describe, expect, it } from 'vitest';
import { bestThirdsSnapshot } from './bestThirds';
import type { Group } from './types';

/**
 * A finished group where team `${name}1` wins all, `${name}2` is clear 2nd,
 * `${name}3` is clear 3rd, `${name}4` last. The 3rd team's points/GD are tuned
 * via how `3` and `4` fare against the top two and each other.
 */
function group(name: string, third: { pts: number; gd: number }): Group {
  const id = (n: number) => `${name}${n}`;
  const teams = [1, 2, 3, 4].map((n) => ({ id: id(n), name: id(n) }));
  // 3rd team always beats 4th (3 pts from that game). To reach `pts`, optionally
  // also draw with 2nd. GD on the 3v4 game is set to `gd`.
  const beatsSecond = third.pts >= 4; // 3 (beat 4) + 1 (draw 2nd)
  return {
    name,
    teams,
    matches: [
      { home: id(1), away: id(2), homeGoals: 1, awayGoals: 0 },
      { home: id(1), away: id(3), homeGoals: 2, awayGoals: 0 },
      { home: id(1), away: id(4), homeGoals: 2, awayGoals: 0 },
      { home: id(2), away: id(3), homeGoals: beatsSecond ? 1 : 2, awayGoals: beatsSecond ? 1 : 0 },
      { home: id(2), away: id(4), homeGoals: 2, awayGoals: 0 },
      { home: id(3), away: id(4), homeGoals: third.gd, awayGoals: 0 }, // 3rd beats 4th by `gd`
    ],
  };
}

describe('best-thirds snapshot', () => {
  it('ranks third-placed teams across groups by points then GD; flags the cutoff', () => {
    const groups = [
      group('A', { pts: 4, gd: 1 }), // strongest 3rd: 4 pts
      group('B', { pts: 3, gd: 3 }), // 3 pts, big GD
      group('C', { pts: 3, gd: 1 }), // 3 pts, smaller GD
    ];
    const snap = bestThirdsSnapshot(groups);
    expect(snap.get('A3')!.rank).toBe(1); // most points
    expect(snap.get('B3')!.rank).toBe(2); // tie on pts with C, better GD
    expect(snap.get('C3')!.rank).toBe(3);
    expect(snap.get('A3')!.currentlyIn).toBe(true); // top-8 cutoff, only 3 groups
  });
});
