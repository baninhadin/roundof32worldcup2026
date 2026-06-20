import { describe, expect, it } from 'vitest';
import { toGroups } from '@/data/adapter';
import { classifyTournament } from './index';
import { standingsView } from '@/lib/standingsView';
import snapshot from '@/data/worldcup2026.snapshot.json';
import type { Group, Match } from './types';
import { enumerateWorlds, playedMatches, unplayedMatches, type Outcome } from './worlds';

// Materialize a W/D/L outcome as a nominal scoreline (1-0 / 1-1 / 0-1), which is
// exactly what the user asked: try every remaining result with fixed scorelines.
function materialize(m: Match, o: Outcome): Match {
  if (o === 'HOME') return { ...m, homeGoals: 1, awayGoals: 0 };
  if (o === 'AWAY') return { ...m, homeGoals: 0, awayGoals: 1 };
  return { ...m, homeGoals: 1, awayGoals: 1 };
}

function withGroupWorld(group: Group, world: Outcome[]): Group {
  const played = playedMatches(group.matches);
  const unplayed = unplayedMatches(group.matches);
  return { ...group, matches: [...played, ...unplayed.map((m, i) => materialize(m, world[i]))] };
}

const base = toGroups(snapshot as never);

describe('property: every remaining-result combination keeps the engine consistent', () => {
  it('holds across all W/D/L worlds of each group (others fixed at current results)', () => {
    let scenarios = 0;

    for (let gi = 0; gi < base.length; gi++) {
      const unplayed = unplayedMatches(base[gi].matches);
      const worlds = enumerateWorlds(unplayed);

      for (const world of worlds) {
        scenarios++;
        const groups = base.map((g, i) => (i === gi ? withGroupWorld(g, world) : g));
        const tournament = classifyTournament(groups); // must never throw

        for (const { group, verdicts } of tournament) {
          const rows = standingsView(group);
          const posOf = new Map(rows.map((r) => [r.teamId, r.position]));
          const groupDone = group.matches.every((m) => m.homeGoals !== null);

          let qualified = 0;
          for (const v of verdicts) {
            // 1. status is always one of the three
            expect(['qualified', 'contention', 'eliminated']).toContain(v.status);
            const pos = posOf.get(v.teamId)!;
            // 2. a qualified team must sit in the top two of its group
            if (v.status === 'qualified') {
              qualified++;
              expect(pos, `${v.teamName} qualified but ${pos}th`).toBeLessThanOrEqual(2);
            }
            // 3. an eliminated team can never be in the top two
            if (v.status === 'eliminated') {
              expect(pos, `${v.teamName} eliminated but ${pos}th`).toBeGreaterThan(2);
            }
          }
          // 4. a finished group sends exactly two teams through
          if (groupDone) {
            expect(qualified, `group ${group.name} finished with ${qualified} qualified`).toBe(2);
          }
        }
      }
    }

    expect(scenarios).toBeGreaterThan(0);
  });
});
