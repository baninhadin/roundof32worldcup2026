import { describe, expect, it } from 'vitest';
import { recordFor } from './standings';
import { fifaRankOf } from './fifaRanking';
import { rankGroup } from './tiebreak';
import { toGroups } from '@/data/adapter';
import snapshot from '@/data/worldcup2026.snapshot.json';
import type { Group, Match, TeamId } from './types';
import { unplayedMatches, playedMatches } from './worlds';

// ---------------------------------------------------------------------------
// Independent oracle: a SECOND, separately-written implementation of the 2026
// ranking rules. The engine (rankGroup) and this oracle share no code, so making
// them agree on every possible scoreline is a real correctness check, not just a
// sanity check.
// ---------------------------------------------------------------------------

const eqKey = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

function bucketize(ids: TeamId[], keyOf: (id: TeamId) => number[]): TeamId[][] {
  const sorted = ids
    .map((id) => ({ id, k: keyOf(id) }))
    .sort((a, b) => {
      for (let i = 0; i < a.k.length; i++) if (a.k[i] !== b.k[i]) return b.k[i] - a.k[i];
      return 0;
    });
  const out: TeamId[][] = [];
  for (const { id } of sorted) {
    const last = out[out.length - 1];
    if (last && eqKey(keyOf(last[0]), keyOf(id))) last.push(id);
    else out.push([id]);
  }
  return out;
}

function byFifa(ids: TeamId[]): TeamId[] {
  return [...ids].sort((a, b) => fifaRankOf(a) - fifaRankOf(b));
}

/** Resolve a set of teams that are level on points, per the 2026 restart rule. */
function resolveCluster(ids: TeamId[], matches: Match[]): TeamId[] {
  if (ids.length <= 1) return ids;
  const set = new Set(ids);
  // Criteria 2-4: head-to-head points, GD, goals among only these teams.
  const hh = bucketize(ids, (id) => {
    const r = recordFor(id, matches, set);
    return [r.points, r.goalDiff, r.goalsFor];
  });
  if (hh.length > 1) return hh.flatMap((b) => resolveCluster(b, matches)); // restart on each subset
  // Criteria 5-6: overall GD then goals.
  const overall = bucketize(ids, (id) => {
    const r = recordFor(id, matches);
    return [r.goalDiff, r.goalsFor];
  });
  if (overall.length > 1) return overall.flatMap((b) => (b.length > 1 ? byFifa(b) : b));
  // Criterion 8: FIFA ranking (criterion 7, conduct, has no data).
  return byFifa(ids);
}

function oracleRank(teamIds: TeamId[], matches: Match[]): TeamId[] {
  return bucketize(teamIds, (id) => [recordFor(id, matches).points]).flatMap((c) =>
    resolveCluster(c, matches),
  );
}

// ---------------------------------------------------------------------------

const A = toGroups(snapshot as never).find((g) => g.name === 'A')!;

describe('engine ranking equals an independent oracle for EVERY final scoreline', () => {
  it('Group A: all 0-5 scorelines of the two remaining games (1296 worlds)', () => {
    const ids = A.teams.map((t) => t.id);
    const played = playedMatches(A.matches);
    const [m1, m2] = unplayedMatches(A.matches);
    let checked = 0;

    for (let a = 0; a <= 5; a++)
      for (let b = 0; b <= 5; b++)
        for (let c = 0; c <= 5; c++)
          for (let d = 0; d <= 5; d++) {
            const matches: Match[] = [
              ...played,
              { ...m1, homeGoals: a, awayGoals: b },
              { ...m2, homeGoals: c, awayGoals: d },
            ];
            const engine = rankGroup(ids, matches).ordered;
            const oracle = oracleRank(ids, matches);
            checked++;
            expect(engine, `CZE-MEX ${a}-${b}, RSA-KOR ${c}-${d}`).toEqual(oracle);
          }

    expect(checked).toBe(1296);
  });
});

describe('engine ranking equals the oracle across every group (current fixtures)', () => {
  it('plays out all remaining scorelines (0-3) per group and checks each result', () => {
    for (const group of toGroups(snapshot as never)) {
      const ids = group.teams.map((t) => t.id);
      const played = playedMatches(group.matches);
      const remaining = unplayedMatches(group.matches);
      if (remaining.length > 3) continue; // keep the combination count bounded

      // Enumerate scorelines 0..3 for each remaining match.
      const perMatch: Array<[number, number]> = [];
      for (let h = 0; h <= 3; h++) for (let aw = 0; aw <= 3; aw++) perMatch.push([h, aw]);

      // Iterate the cartesian product of scorelines over the remaining matches.
      const total = perMatch.length ** remaining.length;
      for (let n = 0; n < total; n++) {
        let x = n;
        const filled = remaining.map((m) => {
          const [hg, ag] = perMatch[x % perMatch.length];
          x = Math.floor(x / perMatch.length);
          return { ...m, homeGoals: hg, awayGoals: ag };
        });
        const matches = [...played, ...filled];
        expect(rankGroup(ids, matches).ordered).toEqual(oracleRank(ids, matches));
      }
    }
  });
});
