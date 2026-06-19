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
    // The draw path must explain the head-to-head reason.
    expect(text(v, 'Draw')).toContain('head-to-head');
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
