import { recordFor } from './standings';
import { rankGroup } from './tiebreak';
import { fifaRankOf } from './fifaRanking';
import type { BestThirdSnapshot, Group, TeamId } from './types';

export const BEST_THIRDS_ADVANCING = 8;

interface ThirdPlace {
  teamId: TeamId;
  groupName: string;
  points: number;
  goalDiff: number;
  goalsFor: number;
}

/**
 * Rank the current third-placed team of every group by the cross-group
 * best-thirds criteria (points -> overall GD -> overall goals; conduct / FIFA
 * ranking disclaimed). Returns a snapshot keyed by team id.
 *
 * This is a LIVE SNAPSHOT on current standings — it answers "as things stand,
 * who are the 8 best thirds?" A fully rigorous conditional best-thirds verdict
 * would require enumerating all 12 groups at once (intractable), so the headline
 * top-two verdicts stay exact while this backdoor view is explicitly provisional.
 */
export function bestThirdsSnapshot(groups: Group[]): Map<TeamId, BestThirdSnapshot> {
  const thirds: ThirdPlace[] = [];

  for (const g of groups) {
    const ids = g.teams.map((t) => t.id);
    const { ordered } = rankGroup(ids, g.matches);
    const thirdId = ordered[2];
    if (!thirdId) continue;
    const r = recordFor(thirdId, g.matches);
    thirds.push({
      teamId: thirdId,
      groupName: g.name,
      points: r.points,
      goalDiff: r.goalDiff,
      goalsFor: r.goalsFor,
    });
  }

  thirds.sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDiff - a.goalDiff ||
      b.goalsFor - a.goalsFor ||
      // Final decider: FIFA ranking (criterion 8), so ties are deterministic.
      fifaRankOf(a.teamId) - fifaRankOf(b.teamId),
  );

  const out = new Map<TeamId, BestThirdSnapshot>();
  thirds.forEach((t, i) => {
    const rank = i + 1;
    out.set(t.teamId, {
      rank,
      cutoff: BEST_THIRDS_ADVANCING,
      currentlyIn: rank <= BEST_THIRDS_ADVANCING,
    });
  });
  return out;
}
