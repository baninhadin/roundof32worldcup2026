import { describe, expect, it } from 'vitest';
import { classifyGroup } from './classify';
import { classifyTournament } from './index';
import { recordFor } from './standings';
import type { Group, Match, TeamId } from './types';

// Real 2026 finalists so FIFA ranking (tiebreaker 8) is always defined.
const NAMES = ['Mexico', 'South Korea', 'Czech Republic', 'South Africa'];

function makeGroup(scores: [number, number][]): Group {
  const ids = NAMES;
  // Round-robin order: 0-1, 0-2, 0-3, 1-2, 1-3, 2-3
  const pairs: [number, number][] = [
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 2],
    [1, 3],
    [2, 3],
  ];
  const matches: Match[] = pairs.map(([h, a], i) => ({
    home: ids[h],
    away: ids[a],
    homeGoals: scores[i][0],
    awayGoals: scores[i][1],
  }));
  return { name: 'X', teams: ids.map((id) => ({ id, name: id })), matches };
}

/** Deterministic PRNG (LCG) so failures reproduce. */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const qualifiedIds = (g: Group): TeamId[] =>
  classifyGroup(g)
    .filter((v) => v.status === 'qualified')
    .map((v) => v.teamId);

describe('exhaustive: every FINISHED group has exactly two qualified teams', () => {
  it('holds across 20000 random finished groups, with points sanity', () => {
    const rnd = lcg(12345);
    const goal = () => Math.floor(rnd() * 5); // 0..4
    for (let iter = 0; iter < 20000; iter++) {
      const scores = Array.from({ length: 6 }, () => [goal(), goal()] as [number, number]);
      const g = makeGroup(scores);
      const qual = qualifiedIds(g);

      // Core invariant: a finished group always sends exactly two teams through.
      expect(qual.length, `iter ${iter} scores ${JSON.stringify(scores)}`).toBe(2);

      // Independent sanity: the two qualifiers can't have fewer points than anyone
      // left behind (points is criterion 1; tiebreakers only ever order equal points).
      const pts = (id: TeamId) => recordFor(id, g.matches).points;
      const minQual = Math.min(...qual.map(pts));
      const maxRest = Math.max(
        ...g.teams.filter((t) => !qual.includes(t.id)).map((t) => pts(t.id)),
      );
      expect(minQual, `iter ${iter} scores ${JSON.stringify(scores)}`).toBeGreaterThanOrEqual(maxRest);
    }
  });
});

describe('exhaustive: real Group A after MD2, every scoreline of the last two games', () => {
  // Standings after MD2 baked in; remaining: Czech v Mexico, South Africa v South Korea.
  const played: Match[] = [
    { home: 'Mexico', away: 'South Africa', homeGoals: 2, awayGoals: 0 },
    { home: 'South Korea', away: 'Czech Republic', homeGoals: 2, awayGoals: 1 },
    { home: 'Czech Republic', away: 'South Africa', homeGoals: 1, awayGoals: 1 },
    { home: 'Mexico', away: 'South Korea', homeGoals: 1, awayGoals: 0 },
  ];
  it('always sends exactly two through, for all 0..5 scorelines (1296 worlds)', () => {
    for (let a = 0; a <= 5; a++)
      for (let b = 0; b <= 5; b++)
        for (let c = 0; c <= 5; c++)
          for (let d = 0; d <= 5; d++) {
            const g: Group = {
              name: 'A',
              teams: NAMES.map((id) => ({ id, name: id })),
              matches: [
                ...played,
                { home: 'Czech Republic', away: 'Mexico', homeGoals: a, awayGoals: b },
                { home: 'South Africa', away: 'South Korea', homeGoals: c, awayGoals: d },
              ],
            };
            expect(qualifiedIds(g).length, `CZE-MEX ${a}-${b}, RSA-KOR ${c}-${d}`).toBe(2);
          }
  });
});

describe("the exact scenario from the bug report", () => {
  it('South Africa beats Korea 2-0, Czech beats Mexico 1-0: Mexico+Czech qualify, Korea out', () => {
    const g: Group = {
      name: 'A',
      teams: NAMES.map((id) => ({ id, name: id })),
      matches: [
        { home: 'Mexico', away: 'South Africa', homeGoals: 2, awayGoals: 0 },
        { home: 'South Korea', away: 'Czech Republic', homeGoals: 2, awayGoals: 1 },
        { home: 'Czech Republic', away: 'South Africa', homeGoals: 1, awayGoals: 1 },
        { home: 'Mexico', away: 'South Korea', homeGoals: 1, awayGoals: 0 },
        { home: 'Czech Republic', away: 'Mexico', homeGoals: 1, awayGoals: 0 },
        { home: 'South Africa', away: 'South Korea', homeGoals: 2, awayGoals: 0 },
      ],
    };
    const verdicts = classifyGroup(g);
    const status = (name: string) => verdicts.find((v) => v.teamName === name)!.status;
    expect(status('Mexico')).toBe('qualified');
    expect(status('Czech Republic')).toBe('qualified'); // 2nd on FIFA ranking after a dead-level tie
    expect(status('South Africa')).toBe('contention'); // 3rd, best-third hope
    expect(status('South Korea')).toBe('contention'); // 4th within the group

    // At tournament level South Korea (last in this group) is eliminated.
    const tourn = classifyTournament([g]).find((t) => t.group.name === 'A')!.verdicts;
    expect(tourn.find((v) => v.teamName === 'South Korea')!.status).toBe('eliminated');
  });
});
