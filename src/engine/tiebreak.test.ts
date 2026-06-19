import { describe, expect, it } from 'vitest';
import { recordFor } from './standings';
import { rankGroup } from './tiebreak';
import { GROUP_A_AFTER_MD2 } from './fixtures.groupA';
import type { Match } from './types';

const ids = GROUP_A_AFTER_MD2.teams.map((t) => t.id);
const M = GROUP_A_AFTER_MD2.matches;

describe('standings (Group A after MD2)', () => {
  it('computes the real table', () => {
    expect(recordFor('MEX', M)).toMatchObject({ points: 6, goalDiff: 3 });
    expect(recordFor('KOR', M)).toMatchObject({ points: 3, goalDiff: 0 });
    expect(recordFor('CZE', M)).toMatchObject({ points: 1, goalDiff: -1 });
    expect(recordFor('RSA', M)).toMatchObject({ points: 1, goalDiff: -2 });
  });

  it('ranks the group by current points', () => {
    expect(rankGroup(ids, M).ordered).toEqual(['MEX', 'KOR', 'CZE', 'RSA']);
  });
});

describe('2026 head-to-head outranks overall goal difference', () => {
  // 4-team group where A and B both finish on 6 points. B has the better OVERALL
  // goal difference (+5 vs +2), but A beat B head-to-head 1-0. Under 2026 rules
  // (H2H = criterion 2, ahead of overall GD = criterion 5), A must rank above B.
  // Under the old 2018/2022 rules B would have been placed first on GD.
  const matches: Match[] = [
    { home: 'A', away: 'B', homeGoals: 1, awayGoals: 0 }, // A beat B (H2H -> A)
    { home: 'A', away: 'C', homeGoals: 2, awayGoals: 0 },
    { home: 'D', away: 'A', homeGoals: 1, awayGoals: 0 }, // A lost to D
    { home: 'B', away: 'C', homeGoals: 3, awayGoals: 0 },
    { home: 'B', away: 'D', homeGoals: 3, awayGoals: 0 },
    { home: 'C', away: 'D', homeGoals: 1, awayGoals: 0 },
  ];

  it('confirms the setup: A and B level on points, B has better GD', () => {
    expect(recordFor('A', matches)).toMatchObject({ points: 6, goalDiff: 2 });
    expect(recordFor('B', matches)).toMatchObject({ points: 6, goalDiff: 5 });
  });

  it('ranks the H2H winner (A) above the better-GD team (B)', () => {
    const r = rankGroup(['A', 'B', 'C', 'D'], matches);
    expect(r.ordered).toEqual(['A', 'B', 'C', 'D']);
    expect(r.unresolved).toEqual([]);
  });
});

describe('rule 8 — FIFA ranking breaks a tie that survives criteria 1–6', () => {
  it('ranks the higher-FIFA-ranked team above when all else is identical', () => {
    // Spain and Croatia: drew head-to-head, identical overall records -> level through
    // criterion 6. Spain is ranked higher, so it should finish above. No unresolved tie.
    const matches: Match[] = [
      { home: 'Spain', away: 'Croatia', homeGoals: 1, awayGoals: 1 },
      { home: 'Spain', away: 'Haiti', homeGoals: 2, awayGoals: 0 },
      { home: 'Croatia', away: 'Haiti', homeGoals: 2, awayGoals: 0 },
    ];
    const r = rankGroup(['Spain', 'Croatia', 'Haiti'], matches);
    expect(r.ordered.slice(0, 2)).toEqual(['Spain', 'Croatia']);
    expect(r.unresolved).toEqual([]);
  });
});

describe('unresolved only when even FIFA ranking cannot separate', () => {
  it('flags two teams identical through criterion 6', () => {
    // KOR and CZE: drew their H2H and have identical overall records
    // -> unresolvable by criteria 1–6; only conduct / FIFA ranking remain.
    const matches: Match[] = [
      { home: 'KOR', away: 'CZE', homeGoals: 1, awayGoals: 1 },
      { home: 'KOR', away: 'RSA', homeGoals: 2, awayGoals: 0 },
      { home: 'CZE', away: 'RSA', homeGoals: 2, awayGoals: 0 },
    ];
    const r = rankGroup(['KOR', 'CZE', 'RSA'], matches);
    expect(r.unresolved.length).toBe(1);
    expect(new Set(r.unresolved[0])).toEqual(new Set(['KOR', 'CZE']));
  });
});
