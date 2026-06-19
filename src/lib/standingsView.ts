import { rankGroup, recordFor, type Group, type Record } from '@/engine';

export interface StandingsRow extends Record {
  position: number;
  teamName: string;
}

/** Current standings table for a group, ranked under the 2026 tiebreakers. */
export function standingsView(group: Group): StandingsRow[] {
  const ids = group.teams.map((t) => t.id);
  const { ordered } = rankGroup(ids, group.matches);
  return ordered.map((id, i) => ({
    ...recordFor(id, group.matches),
    position: i + 1,
    teamName: group.teams.find((t) => t.id === id)!.name,
  }));
}
