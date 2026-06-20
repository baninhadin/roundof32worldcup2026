import { describe, expect, it } from 'vitest';
import { classifyGroup } from './classify';
import { GROUP_A_AFTER_MD2 } from './fixtures.groupA';
import type { TeamVerdict } from './types';

const verdicts = classifyGroup(GROUP_A_AFTER_MD2);
const byId = (id: string) => verdicts.find((v) => v.teamId === id) as TeamVerdict;
const cond = (v: TeamVerdict, outcome: string) => v.conditions.find((c) => c.outcome === outcome);
const text = (v: TeamVerdict, outcome: string) => {
  const c = cond(v, outcome);
  return [...(c?.lines ?? []), c?.note ?? ''].join(' ').toLowerCase();
};

describe('Group A golden oracle (corrected for 2026 rules)', () => {
  it('Mexico — guaranteed through', () => {
    expect(byId('MEX').status).toBe('qualified');
    expect(byId('MEX').headline).toBe('Qualified');
  });

  it('South Korea — through with a WIN or a DRAW (beat Czechia head-to-head)', () => {
    const v = byId('KOR');
    expect(v.status).toBe('contention');
    expect(cond(v, 'Win')?.guarantees).toBe(true);
    expect(cond(v, 'Draw')?.guarantees).toBe(true);
    expect(cond(v, 'Loss')?.guarantees).toBe(false);
    expect(v.headline.toLowerCase()).toContain('win or draw');
    // The draw path must explain the head to head reason.
    expect(text(v, 'Draw')).toContain('head to head');
  });

  it('South Africa — must beat South Korea; then GD battle vs Czechia', () => {
    const v = byId('RSA');
    expect(v.status).toBe('contention');
    expect(cond(v, 'Draw')?.guarantees).toBe(false);
    expect(cond(v, 'Loss')?.guarantees).toBe(false);
    expect(cond(v, 'Win')?.guarantees).toBe(false);
    // The win path must mention the goal-difference fallback.
    expect(text(v, 'Win')).toContain('goal difference');
  });

  it('Czechia — must beat Mexico AND need South Korea to lose', () => {
    const v = byId('CZE');
    expect(v.status).toBe('contention');
    expect(cond(v, 'Win')?.guarantees).toBe(false);
    expect(text(v, 'Win')).toMatch(/goal difference|out|best-third/);
    // Headline should convey that even winning needs South Korea to lose.
    expect(v.headline.toLowerCase()).toMatch(/need south korea to lose/);
  });

  it('handles a team that finished its games while the group has matches left', () => {
    // A played all three; B v C still to play. A must not crash (regression for simulate).
    const group = {
      name: 'X',
      teams: ['A', 'B', 'C', 'D'].map((n) => ({ id: n, name: n })),
      matches: [
        { home: 'A', away: 'B', homeGoals: 0, awayGoals: 1 }, // A lost
        { home: 'A', away: 'C', homeGoals: 0, awayGoals: 1 }, // A lost
        { home: 'A', away: 'D', homeGoals: 1, awayGoals: 0 }, // A beat D (A finished, 3 pts)
        { home: 'B', away: 'D', homeGoals: 1, awayGoals: 0 },
        { home: 'C', away: 'D', homeGoals: 1, awayGoals: 0 },
        { home: 'B', away: 'C', homeGoals: null, awayGoals: null }, // group not finished
      ],
    };
    const a = classifyGroup(group).find((v) => v.teamId === 'A')!;
    // A can't make the top two (B and C are clear above it), so it reads as a
    // best-third hope, computed from the remaining match, not a bail-out.
    expect(a.headline.toLowerCase()).toContain('best third');
    expect(a.status).not.toBe('qualified');
  });

  it('a draw between two level teams resolves on locked goal difference, not "decides"', () => {
    // Group D shape: USA clear 1st. Australia (GD 0) and Paraguay (GD -2) are level on
    // points and play each other last. A draw freezes the GD gap, so Australia is
    // through and Paraguay is out, definitively, no "goal difference decides".
    const group = {
      name: 'D',
      teams: ['USA', 'Australia', 'Paraguay', 'Turkey'].map((n) => ({ id: n, name: n })),
      matches: [
        { home: 'USA', away: 'Paraguay', homeGoals: 4, awayGoals: 1 },
        { home: 'Australia', away: 'Turkey', homeGoals: 2, awayGoals: 0 },
        { home: 'USA', away: 'Australia', homeGoals: 2, awayGoals: 0 },
        { home: 'Turkey', away: 'Paraguay', homeGoals: 0, awayGoals: 1 },
        { home: 'Turkey', away: 'USA', homeGoals: null, awayGoals: null },
        { home: 'Paraguay', away: 'Australia', homeGoals: null, awayGoals: null },
      ],
    };
    const v = classifyGroup(group);
    const aus = v.find((x) => x.teamId === 'Australia')!;
    const par = v.find((x) => x.teamId === 'Paraguay')!;
    // Australia draws -> through, with a locked-GD note, not "goal difference decides".
    const ausDraw = aus.conditions.find((c) => c.outcome === 'Draw')!;
    expect(ausDraw.guarantees).toBe(true);
    expect((ausDraw.note ?? '').toLowerCase()).toContain('goal difference');
    expect(ausDraw.lines.join(' ').toLowerCase()).not.toContain('decides');
    expect(aus.headline.toLowerCase()).toContain('win or draw');
    // Paraguay draws -> out, not "decides".
    const parDraw = par.conditions.find((c) => c.outcome === 'Draw')!;
    expect(parDraw.guarantees).toBe(false);
    expect(parDraw.lines.join(' ').toLowerCase()).not.toContain('decides');
  });

  it('no em-dashes in any generated copy', () => {
    for (const v of verdicts) {
      expect(v.headline).not.toContain('—');
      for (const c of v.conditions) {
        for (const l of c.lines) expect(l).not.toContain('—');
        if (c.note) expect(c.note).not.toContain('—');
      }
    }
  });
});
