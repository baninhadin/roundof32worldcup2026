import { recordsFor } from './standings';
import type { Match, Record, TeamId } from './types';

export interface GroupRanking {
  /** Team ids best -> worst. */
  ordered: TeamId[];
  /** Clusters (size > 1) that criteria 1–6 could not separate; only 7–8 (conduct,
   *  FIFA ranking) would break them. Surfaced honestly rather than guessed. */
  unresolved: TeamId[][];
}

const cmp = (a: number, b: number) => b - a; // higher is better

/**
 * Rank a set of teams already known to be level on POINTS, applying the 2026
 * criteria 2–6 with the official "restart" behaviour: head-to-head is computed
 * among the tied set, and if it leaves a smaller subset still level, head-to-head
 * is re-applied to that subset before falling through to overall GD/goals.
 */
function rankTied(
  teamIds: TeamId[],
  allMatches: Match[],
  unresolved: TeamId[][],
): TeamId[] {
  if (teamIds.length <= 1) return teamIds;

  const set = new Set(teamIds);
  const hh = recordsFor(teamIds, allMatches, set); // criteria 2–4: H2H among this set only

  // Bucket by head-to-head keys (pts, gd, goals).
  const byHH = bucket(teamIds, (id) => {
    const r = hh.get(id)!;
    return [r.points, r.goalDiff, r.goalsFor];
  });

  if (byHH.length > 1) {
    // H2H separated them into ordered buckets. Restart the whole procedure on
    // each smaller bucket (each is strictly smaller, so this terminates).
    const out: TeamId[] = [];
    for (const b of byHH) out.push(...rankTied(b, allMatches, unresolved));
    return out;
  }

  // H2H did not separate anyone -> criteria 5–6: overall GD, then overall goals.
  const overall = recordsFor(teamIds, allMatches);
  const byOverall = bucket(teamIds, (id) => {
    const r = overall.get(id)!;
    return [r.goalDiff, r.goalsFor];
  });

  if (byOverall.length === 1) {
    // Fully tied through criterion 6 -> only conduct / FIFA ranking remain.
    unresolved.push([...teamIds]);
    return [...teamIds];
  }

  const out: TeamId[] = [];
  for (const b of byOverall) {
    if (b.length > 1) unresolved.push([...b]); // tied on 5–6 too
    out.push(...b);
  }
  return out;
}

/** Group ids into ordered buckets by a numeric key vector (desc), preserving
 *  ties as multi-member buckets. */
function bucket(ids: TeamId[], key: (id: TeamId) => number[]): TeamId[][] {
  const keyed = ids.map((id) => ({ id, k: key(id) }));
  keyed.sort((a, b) => {
    for (let i = 0; i < a.k.length; i++) {
      const d = cmp(a.k[i], b.k[i]);
      if (d !== 0) return d;
    }
    return 0;
  });
  const buckets: TeamId[][] = [];
  for (const { id, k } of keyed) {
    const last = buckets[buckets.length - 1];
    if (last && sameKey(key(last[0]), k)) last.push(id);
    else buckets.push([id]);
  }
  return buckets;
}

const sameKey = (a: number[], b: number[]) => a.every((v, i) => v === b[i]);

/** Rank all teams in a group under the 2026 tiebreakers (criteria 1–6). */
export function rankGroup(teamIds: TeamId[], allMatches: Match[]): GroupRanking {
  const overall = recordsFor(teamIds, allMatches);
  const unresolved: TeamId[][] = [];

  // Criterion 1: points. Cluster equal-points teams, then resolve each cluster.
  const byPoints = bucket(teamIds, (id) => [overall.get(id)!.points]);
  const ordered: TeamId[] = [];
  for (const cluster of byPoints) {
    ordered.push(...rankTied(cluster, allMatches, unresolved));
  }
  return { ordered, unresolved };
}

export type { Record };
