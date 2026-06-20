import { recordFor } from './standings';
import type { Match, TeamId } from './types';

/** Result of a single match from the home team's perspective. */
export type Outcome = 'HOME' | 'DRAW' | 'AWAY';
export const OUTCOMES: Outcome[] = ['HOME', 'DRAW', 'AWAY'];

/** Whether the top-2 boundary places a team in/out, or leaves it on a tie that
 *  only goal difference (criteria 3–6) can resolve. */
export type BoundaryStatus = 'in' | 'out' | 'gd';

export const unplayedMatches = (matches: Match[]): Match[] =>
  matches.filter((m) => m.homeGoals === null || m.awayGoals === null);

export const playedMatches = (matches: Match[]): Match[] =>
  matches.filter((m) => m.homeGoals !== null && m.awayGoals !== null);

/** Turn a W/D/L outcome into a nominal 1-0 / 0-0 scoreline so points and
 *  head-to-head POINTS are well-defined. Goal *difference* from these nominal
 *  scores is deliberately NOT trusted — GD ties fall through to `gd`. */
function materialize(m: Match, o: Outcome): Match {
  if (o === 'HOME') return { ...m, homeGoals: 1, awayGoals: 0 };
  if (o === 'AWAY') return { ...m, homeGoals: 0, awayGoals: 1 };
  return { ...m, homeGoals: 0, awayGoals: 0 };
}

/** All 3^n outcome assignments over the unplayed matches. n is tiny (<=6). */
export function enumerateWorlds(unplayed: Match[]): Outcome[][] {
  const worlds: Outcome[][] = [[]];
  for (let i = 0; i < unplayed.length; i++) {
    const next: Outcome[][] = [];
    for (const w of worlds) for (const o of OUTCOMES) next.push([...w, o]);
    worlds.splice(0, worlds.length, ...next);
  }
  return worlds;
}

/** Build the full match list for a world: played matches as-is, unplayed
 *  materialized from the outcome assignment. */
export function worldMatches(
  played: Match[],
  unplayed: Match[],
  world: Outcome[],
): Match[] {
  return [...played, ...unplayed.map((m, i) => materialize(m, world[i]))];
}

/**
 * Decide whether `teamId` makes the top 2 in a given fully-decided-by-result
 * world, using ONLY criterion 1 (points) and criterion 2 (head-to-head points).
 * Anything that remains tied after those needs goal difference -> 'gd'.
 *
 * Also reports the rivals it is tied with (for GD-threshold copy).
 */
export interface Boundary {
  status: BoundaryStatus;
  /** Peers tied on points AND head-to-head points, separable only by GD. */
  tiedWith: TeamId[];
  /** Peers tied on points whom this team finishes ABOVE on head-to-head points
   *  (the "why" behind a result being enough under the 2026 H2H-first rule). */
  wonHeadToHeadOver: TeamId[];
  /** Peers this team finishes above on a goal difference that is already LOCKED
   *  (e.g. a draw between the two tied teams can't move the gap). */
  aheadOnLockedGd: TeamId[];
}

const emptyBoundary = (status: BoundaryStatus): Boundary => ({
  status,
  tiedWith: [],
  wonHeadToHeadOver: [],
  aheadOnLockedGd: [],
});

export function topTwoBoundary(
  teamId: TeamId,
  teamIds: TeamId[],
  matches: Match[],
  cutoff = 2,
  /** Teams whose final goal difference is already locked (no remaining game can
   *  move it, e.g. their only game left is a draw). Lets a GD tie resolve now. */
  gdLocked?: Set<TeamId>,
): Boundary {
  const pts = new Map<TeamId, number>();
  for (const id of teamIds) pts.set(id, recordFor(id, matches).points);

  const myPts = pts.get(teamId)!;
  const above = teamIds.filter((id) => id !== teamId && pts.get(id)! > myPts).length;
  const cluster = teamIds.filter((id) => pts.get(id)! === myPts);

  if (cluster.length === 1) {
    // No one shares my points: position is fixed by points alone.
    return emptyBoundary(above <= cutoff - 1 ? 'in' : 'out');
  }

  // Criterion 2: head-to-head points among the tied cluster only.
  const set = new Set(cluster);
  const hhPts = new Map<TeamId, number>();
  for (const id of cluster) hhPts.set(id, recordFor(id, matches, set).points);

  const myHH = hhPts.get(teamId)!;
  const strictlyAbove = cluster.filter((id) => id !== teamId && hhPts.get(id)! > myHH).length;
  const tiedPeers = cluster.filter((id) => id !== teamId && hhPts.get(id)! === myHH);
  const wonHeadToHeadOver = cluster.filter((id) => id !== teamId && hhPts.get(id)! < myHH);

  const best = above + strictlyAbove; // 0-based best possible position
  const worst = best + tiedPeers.length; // if every tied peer edges above me

  if (worst <= cutoff - 1) return { ...emptyBoundary('in'), wonHeadToHeadOver };
  if (best >= cutoff) return emptyBoundary('out');

  // The cut runs through a head-to-head-points tie. Normally goal difference is an
  // open threshold, but if every tied team's GD is already LOCKED, it's decided now.
  if (gdLocked && teamId && tiedPeers.every((id) => gdLocked.has(id)) && gdLocked.has(teamId)) {
    const gd = (id: TeamId) => recordFor(id, matches).goalDiff;
    const myGd = gd(teamId);
    const gdAbove = tiedPeers.filter((id) => gd(id) > myGd).length;
    const gdEqual = tiedPeers.filter((id) => gd(id) === myGd).length;
    const aheadOnLockedGd = tiedPeers.filter((id) => gd(id) < myGd);
    const bestPos = best + gdAbove; // 0-based
    const worstPos = bestPos + gdEqual; // GD ties (goals scored still open) sit below
    if (worstPos <= cutoff - 1) return { ...emptyBoundary('in'), wonHeadToHeadOver, aheadOnLockedGd };
    if (bestPos >= cutoff) return emptyBoundary('out');
    // Otherwise a real GD tie remains among locked teams -> goals scored, still open.
  }

  return { ...emptyBoundary('gd'), tiedWith: tiedPeers, wonHeadToHeadOver };
}

/** Final position bucket (1-based) ignoring GD ties — used for best-third
 *  detection: a team is "3rd" if exactly two teams clearly finish above it. */
export function clearlyThirdOrLower(
  teamId: TeamId,
  teamIds: TeamId[],
  matches: Match[],
): boolean {
  return topTwoBoundary(teamId, teamIds, matches).status === 'out';
}
