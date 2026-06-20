import { describe, expect, it } from 'vitest';
import { toGroups } from '@/data/adapter';
import { classifyTournament } from './index';
import { recordFor } from './standings';
import { fifaRankOf } from './fifaRanking';
import snapshot from '@/data/worldcup2026.snapshot.json';
import type { Group, TeamId } from './types';

// Heavy soundness check, run with `npm run verify` (skipped in the normal suite).
// It random-finishes the tournament many times and asserts the engine's guarantees
// never break: a team marked "qualified" must end in the Round of 32 in EVERY
// completion, and a team marked "eliminated" must end in it in NONE.
const HEAVY = process.env.VERIFY === '1';

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
const byFifa = (ids: TeamId[]) => [...ids].sort((a, b) => fifaRankOf(a) - fifaRankOf(b));

// Independent ranker (separate from the engine), used to judge each completion.
function oracleRank(ids: TeamId[], matches: Group['matches']): TeamId[] {
  const resolve = (cluster: TeamId[]): TeamId[] => {
    if (cluster.length <= 1) return cluster;
    const set = new Set(cluster);
    const hh = bucketize(cluster, (id) => {
      const r = recordFor(id, matches, set);
      return [r.points, r.goalDiff, r.goalsFor];
    });
    if (hh.length > 1) return hh.flatMap(resolve);
    const ov = bucketize(cluster, (id) => {
      const r = recordFor(id, matches);
      return [r.goalDiff, r.goalsFor];
    });
    if (ov.length > 1) return ov.flatMap((b) => (b.length > 1 ? byFifa(b) : b));
    return byFifa(cluster);
  };
  return bucketize(ids, (id) => [recordFor(id, matches).points]).flatMap(resolve);
}

function finalThirtyTwo(groups: Group[]): Set<TeamId> {
  const set = new Set<TeamId>();
  const thirds: { id: TeamId; pts: number; gd: number; gf: number }[] = [];
  for (const g of groups) {
    const order = oracleRank(
      g.teams.map((t) => t.id),
      g.matches,
    );
    set.add(order[0]);
    set.add(order[1]);
    const r = recordFor(order[2], g.matches);
    thirds.push({ id: order[2], pts: r.points, gd: r.goalDiff, gf: r.goalsFor });
  }
  thirds.sort(
    (a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || fifaRankOf(a.id) - fifaRankOf(b.id),
  );
  thirds.slice(0, 8).forEach((t) => set.add(t.id));
  return set;
}

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 0xffffffff);
}

function randomComplete(groups: Group[], rnd: () => number): Group[] {
  return groups.map((g) => ({
    ...g,
    matches: g.matches.map((m) =>
      m.homeGoals !== null
        ? m
        : { ...m, homeGoals: Math.floor(rnd() * 4), awayGoals: Math.floor(rnd() * 4) },
    ),
  }));
}

function randomPartial(groups: Group[], rnd: () => number): Group[] {
  return groups.map((g) => ({
    ...g,
    matches: g.matches.map((m) =>
      rnd() < 0.6
        ? { ...m, homeGoals: Math.floor(rnd() * 4), awayGoals: Math.floor(rnd() * 4) }
        : { ...m, homeGoals: null, awayGoals: null },
    ),
  }));
}

describe.skipIf(!HEAVY)('soundness: qualified/eliminated guarantees hold under random completion', () => {
  it('current snapshot + 40 random partial states, 2000 completions each', { timeout: 180_000 }, () => {
    const rnd = lcg(20260621);
    const states: Group[][] = [toGroups(snapshot as never)];
    for (let i = 0; i < 40; i++) states.push(randomPartial(toGroups(snapshot as never), rnd));

    for (const state of states) {
      const verdicts = classifyTournament(state).flatMap((t) => t.verdicts);
      const qualified = verdicts.filter((v) => v.status === 'qualified').map((v) => v.teamId);
      const eliminated = verdicts.filter((v) => v.status === 'eliminated').map((v) => v.teamId);

      for (let n = 0; n < 2000; n++) {
        const f32 = finalThirtyTwo(randomComplete(state, rnd));
        for (const q of qualified) {
          expect(f32.has(q), `qualified ${q} missed the Round of 32 in a completion`).toBe(true);
        }
        for (const e of eliminated) {
          expect(f32.has(e), `eliminated ${e} reached the Round of 32 in a completion`).toBe(false);
        }
      }
    }
  });
});
