import { classifyGroup } from './classify';
import { bestThirdsSnapshot } from './bestThirds';
import { eliminations, type EliminationReason } from './feasibility';
import type { Group, TeamVerdict } from './types';

export * from './types';
export { classifyGroup } from './classify';
export { bestThirdsSnapshot, BEST_THIRDS_ADVANCING } from './bestThirds';
export { eliminations, groupFeasibility } from './feasibility';
export { rankGroup } from './tiebreak';
export { recordFor } from './standings';

export interface GroupVerdicts {
  group: Group;
  verdicts: TeamVerdict[];
}

function eliminatedVerdict(base: TeamVerdict, reason: EliminationReason): TeamVerdict {
  const line =
    reason === 'last'
      ? "Can't qualify, finishing last and last place never makes the best thirds"
      : "Can't qualify, can't make the top two and can't reach the 8 best thirds";
  return {
    ...base,
    status: 'eliminated',
    headline: "Can't qualify",
    conditions: [{ outcome: 'Out', lines: [line], guarantees: false }],
    bestThird: null,
    disclaimsDeepTiebreak: false,
  };
}

/**
 * Classify every group, decide mathematical eliminations across groups, and
 * overlay the live best-thirds snapshot so a team currently sitting third sees
 * where it stands in the race for the 8 spots.
 */
export function classifyTournament(groups: Group[]): GroupVerdicts[] {
  const thirds = bestThirdsSnapshot(groups);
  const elim = eliminations(groups);
  return groups.map((group) => {
    const verdicts = classifyGroup(group).map((v) => {
      const reason = elim.get(v.teamId);
      if (reason) return eliminatedVerdict(v, reason);
      return { ...v, bestThird: thirds.get(v.teamId) ?? null };
    });
    return { group, verdicts };
  });
}
