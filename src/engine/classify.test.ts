import { describe, expect, it } from 'vitest';
import { classifyGroup } from './classify';
import { GROUP_A_AFTER_MD2 } from './fixtures.groupA';
import type { TeamVerdict } from './types';

const verdicts = classifyGroup(GROUP_A_AFTER_MD2);
const byId = (id: string) => verdicts.find((v) => v.teamId === id) as TeamVerdict;
const cond = (v: TeamVerdict, outcome: string) =>
  v.conditions.find((c) => c.outcome === outcome);

describe('Group A golden oracle (corrected for 2026 rules)', () => {
  it('Mexico — guaranteed through', () => {
    expect(byId('MEX').status).toBe('qualified');
  });

  it('South Korea — through with a WIN or a DRAW (beat Czechia head-to-head)', () => {
    const v = byId('KOR');
    expect(v.status).toBe('contention');
    // The crux of the 2026 correction: a draw is enough.
    expect(cond(v, 'Win')?.guarantees).toBe(true);
    expect(cond(v, 'Draw')?.guarantees).toBe(true);
    // A loss closes the top-two route.
    expect(cond(v, 'Loss')?.guarantees).toBe(false);
    expect(v.headline.toLowerCase()).toContain('win or a draw');
  });

  it('South Africa — must beat South Korea; then GD battle vs Czechia', () => {
    const v = byId('RSA');
    expect(v.status).toBe('contention');
    expect(cond(v, 'Draw')?.guarantees).toBe(false);
    expect(cond(v, 'Loss')?.guarantees).toBe(false);
    // A win is NOT an automatic guarantee — Czechia winning forces a GD decision.
    expect(cond(v, 'Win')?.guarantees).toBe(false);
    // The win path must mention the goal-difference fallback vs Czechia.
    expect(cond(v, 'Win')?.detail.toLowerCase()).toContain('goal difference');
    expect(v.disclaimsDeepTiebreak === true || cond(v, 'Win')?.detail.includes('Czechia')).toBe(true);
  });

  it('Czechia — must beat Mexico AND need South Korea to lose', () => {
    const v = byId('CZE');
    expect(v.status).toBe('contention');
    expect(cond(v, 'Draw')?.guarantees).toBe(false);
    expect(cond(v, 'Loss')?.guarantees).toBe(false);
    expect(cond(v, 'Win')?.guarantees).toBe(false);
    // Winning still leaves them needing South Korea to lose -> the win path is conditional.
    expect(cond(v, 'Win')?.detail.toLowerCase()).toMatch(/goal difference|out|best-third/);
  });
});
