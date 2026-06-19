import type { Group, Match } from '@/engine/types';

/** Shape of an openfootball/worldcup.json match entry (the bits we use). */
interface OpenFootballMatch {
  round?: string;
  date?: string;
  team1: string;
  team2: string;
  group?: string;
  score?: { ft?: [number, number] } | null;
}

interface OpenFootballFile {
  name?: string;
  matches: OpenFootballMatch[];
}

const GROUP_RE = /^Group\s+([A-L])$/;

/** Stable id for a team — its name is unique within the tournament. */
const teamId = (name: string) => name;

/**
 * Transform an openfootball/worldcup.json document into our Group[] model.
 * Only group-stage matches are used; knockout fixtures are ignored. Works
 * identically for the live fetch and the bundled snapshot.
 */
export function toGroups(file: OpenFootballFile): Group[] {
  const byGroup = new Map<string, OpenFootballMatch[]>();
  for (const m of file.matches) {
    const g = m.group?.match(GROUP_RE)?.[1];
    if (!g) continue;
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(m);
  }

  const groups: Group[] = [];
  for (const letter of [...byGroup.keys()].sort()) {
    const raw = byGroup.get(letter)!;
    const names = new Set<string>();
    for (const m of raw) {
      names.add(m.team1);
      names.add(m.team2);
    }
    const teams = [...names].map((name) => ({ id: teamId(name), name }));

    const matches: Match[] = raw.map((m) => {
      const ft = m.score?.ft;
      return {
        home: teamId(m.team1),
        away: teamId(m.team2),
        homeGoals: ft ? ft[0] : null,
        awayGoals: ft ? ft[1] : null,
      };
    });

    groups.push({ name: letter, teams, matches });
  }

  return groups;
}
