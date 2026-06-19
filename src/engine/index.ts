import { classifyGroup } from './classify';
import { bestThirdsSnapshot } from './bestThirds';
import type { Group, TeamVerdict } from './types';

export * from './types';
export { classifyGroup } from './classify';
export { bestThirdsSnapshot, BEST_THIRDS_ADVANCING } from './bestThirds';
export { rankGroup } from './tiebreak';
export { recordFor } from './standings';

export interface GroupVerdicts {
  group: Group;
  verdicts: TeamVerdict[];
}

/**
 * Classify every group and overlay the live best-thirds snapshot, so a team that
 * currently sits third sees where it stands in the cross-group race for the 8 spots.
 */
export function classifyTournament(groups: Group[]): GroupVerdicts[] {
  const thirds = bestThirdsSnapshot(groups);
  return groups.map((group) => {
    const verdicts = classifyGroup(group).map((v) => ({
      ...v,
      bestThird: thirds.get(v.teamId) ?? null,
    }));
    return { group, verdicts };
  });
}
