import { recordFor } from './standings';
import { rankGroup } from './tiebreak';
import {
  enumerateWorlds,
  playedMatches,
  topTwoBoundary,
  unplayedMatches,
  worldMatches,
} from './worlds';
import { BEST_THIRDS_ADVANCING } from './bestThirds';
import type { Group, TeamId } from './types';

export interface TeamFeasibility {
  /** Can still finish in the top 2 in at least one remaining scenario. */
  canMakeTopTwo: boolean;
  /** Can still finish 3rd (or better) in some scenario, i.e. not doomed to last. */
  canFinishThird: boolean;
  /** Absolute maximum final points the team can still reach. */
  maxPoints: number;
}

export interface GroupFeasibility {
  byTeam: Map<TeamId, TeamFeasibility>;
  /** Fewest points the group's 3rd-placed team can end on, across all scenarios. */
  minThirdPoints: number;
  /** Most points the group's 3rd-placed team can end on, across all scenarios. */
  maxThirdPoints: number;
}

/** Points of the team that finishes 3rd = 3rd largest points value in the group. */
function thirdPlacePoints(teamIds: TeamId[], matches: ReturnType<typeof worldMatches>): number {
  const pts = teamIds.map((id) => recordFor(id, matches).points).sort((a, b) => b - a);
  return pts[2] ?? 0;
}

export function groupFeasibility(group: Group): GroupFeasibility {
  const teamIds = group.teams.map((t) => t.id);
  const played = playedMatches(group.matches);
  const unplayed = unplayedMatches(group.matches);

  // Group finished: positions are exact (real goal difference), so rank them
  // directly instead of the goal-difference-blind W/D/L boundary.
  if (unplayed.length === 0) {
    const { ordered } = rankGroup(teamIds, group.matches);
    const byTeam = new Map<TeamId, TeamFeasibility>();
    ordered.forEach((id, idx) => {
      byTeam.set(id, {
        canMakeTopTwo: idx < 2,
        canFinishThird: idx < 3,
        maxPoints: recordFor(id, played).points,
      });
    });
    const thirdPts = recordFor(ordered[2], group.matches).points;
    return { byTeam, minThirdPoints: thirdPts, maxThirdPoints: thirdPts };
  }

  const worlds = enumerateWorlds(unplayed);

  const byTeam = new Map<TeamId, TeamFeasibility>();
  for (const id of teamIds) {
    const remaining = unplayed.filter((m) => m.home === id || m.away === id).length;
    byTeam.set(id, {
      canMakeTopTwo: false,
      canFinishThird: false,
      maxPoints: recordFor(id, played).points + 3 * remaining,
    });
  }

  let minThird = Infinity;
  let maxThird = 0;
  for (const w of worlds) {
    const wm = worldMatches(played, unplayed, w);
    const t = thirdPlacePoints(teamIds, wm);
    if (t < minThird) minThird = t;
    if (t > maxThird) maxThird = t;
    for (const id of teamIds) {
      const f = byTeam.get(id)!;
      if (!f.canMakeTopTwo && topTwoBoundary(id, teamIds, wm, 2).status !== 'out') f.canMakeTopTwo = true;
      if (!f.canFinishThird && topTwoBoundary(id, teamIds, wm, 3).status !== 'out') f.canFinishThird = true;
    }
  }

  return { byTeam, minThirdPoints: Number.isFinite(minThird) ? minThird : 0, maxThirdPoints: maxThird };
}

export type EliminationReason = 'last' | 'bestThird';

/**
 * Decide which teams are mathematically out, across the whole tournament.
 *
 * Sound and tractable thanks to group independence: a team is out if it can't
 * make the top 2 AND either it is doomed to last (4th can never be a best third),
 * or at least 8 OTHER groups are forced to produce a 3rd-placed team with strictly
 * more points than this team's maximum reachable points (so it can't crack the 8).
 * Points-only, so it never falsely eliminates; goal-difference edge cases stay alive.
 */
export function eliminations(groups: Group[]): Map<TeamId, EliminationReason> {
  const per = groups.map((g) => ({ name: g.name, group: g, feas: groupFeasibility(g) }));
  const out = new Map<TeamId, EliminationReason>();

  for (const { name, group, feas } of per) {
    for (const team of group.teams) {
      const tf = feas.byTeam.get(team.id)!;
      if (tf.canMakeTopTwo) continue;
      if (!tf.canFinishThird) {
        out.set(team.id, 'last');
        continue;
      }
      const forcedAbove = per.filter(
        (o) => o.name !== name && o.feas.minThirdPoints > tf.maxPoints,
      ).length;
      if (forcedAbove >= BEST_THIRDS_ADVANCING) out.set(team.id, 'bestThird');
    }
  }

  return out;
}

/**
 * Teams GUARANTEED to reach the Round of 32 via the best-third route (beyond those
 * already guaranteed top two). Sound by group independence: a team is safe if, in
 * EVERY remaining scenario of its own group, it is either top two, or finishes 3rd
 * with at most 7 other groups able to field a third on at least as many points (so
 * at most 7 thirds can sit above it -> it is no worse than 8th of the twelve thirds).
 */
export function guaranteedThirdAdvancers(groups: Group[]): Set<TeamId> {
  const per = groups.map((g) => ({ name: g.name, feas: groupFeasibility(g) }));
  const maxThirdOf = new Map(per.map((p) => [p.name, p.feas.maxThirdPoints]));
  const safe = new Set<TeamId>();

  for (const group of groups) {
    const teamIds = group.teams.map((t) => t.id);
    const played = playedMatches(group.matches);
    const unplayed = unplayedMatches(group.matches);
    const worlds = enumerateWorlds(unplayed);

    for (const team of group.teams) {
      let guaranteed = true;
      let everThird = false;

      for (const w of worlds) {
        const wm = worldMatches(played, unplayed, w);
        // Use the boundary checks, not the nominal rank: whether a team is top two
        // or top three can itself come down to goal difference, so a nominal
        // position would lie. "in" = safely inside the cut on points + head-to-head.
        if (topTwoBoundary(team.id, teamIds, wm, 2).status === 'in') continue; // safely top two
        const topThree = topTwoBoundary(team.id, teamIds, wm, 3).status === 'in';
        if (!topThree) {
          guaranteed = false; // could be 4th, or 3rd/4th hinges on goal difference
          break;
        }
        // Safely 3rd: can it be pushed out of the 8? Count other groups whose third
        // could reach at least its points (a tie could go against it, so count it).
        everThird = true;
        const myPts = recordFor(team.id, wm).points;
        let couldBeAbove = 0;
        for (const [gName, maxPts] of maxThirdOf) {
          if (gName !== group.name && maxPts >= myPts) couldBeAbove++;
        }
        if (couldBeAbove > BEST_THIRDS_ADVANCING - 1) {
          guaranteed = false;
          break;
        }
      }

      if (guaranteed && everThird) safe.add(team.id);
    }
  }

  return safe;
}
