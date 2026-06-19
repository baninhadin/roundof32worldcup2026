import { describe, expect, it } from 'vitest';
import { toGroups } from './adapter';
import { classifyTournament } from '@/engine';
import snapshot from './worldcup2026.snapshot.json';

const groups = toGroups(snapshot as never);

describe('openfootball adapter + full-tournament integration', () => {
  it('parses all 12 groups of 4 teams', () => {
    expect(groups.length).toBe(12);
    for (const g of groups) expect(g.teams.length).toBe(4);
  });

  it('reproduces the real Group A standings via the engine', () => {
    const a = groups.find((g) => g.name === 'A')!;
    expect(a.teams.map((t) => t.name).sort()).toEqual(
      ['Czech Republic', 'Mexico', 'South Africa', 'South Korea'],
    );
    const tournament = classifyTournament(groups);
    const aVerdicts = tournament.find((t) => t.group.name === 'A')!.verdicts;
    const mex = aVerdicts.find((v) => v.teamName === 'Mexico')!;
    const kor = aVerdicts.find((v) => v.teamName === 'South Korea')!;
    expect(mex.status).toBe('qualified');
    // The corrected 2026 result: South Korea through with a win OR a draw.
    expect(kor.headline.toLowerCase()).toContain('win or a draw');
  });

  it('produces a best-thirds snapshot ranking across groups', () => {
    const tournament = classifyTournament(groups);
    const withRank = tournament
      .flatMap((t) => t.verdicts)
      .filter((v) => v.bestThird !== null);
    // One current third-placed team per group.
    expect(withRank.length).toBe(12);
    const ranks = withRank.map((v) => v.bestThird!.rank).sort((a, b) => a - b);
    expect(ranks).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
});
