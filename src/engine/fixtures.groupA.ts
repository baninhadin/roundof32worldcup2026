import type { Group } from './types';

/**
 * Real 2026 World Cup Group A after Matchday 2 (confirmed vs Wikipedia, 2026-06-18).
 * The golden test case — exercises points, head-to-head (the CZE–SA 1-1 draw and
 * SK 2-1 CZE result), the overall-GD threshold, and the best-third backdoor.
 *
 * Standings after MD2: Mexico 6/+3, South Korea 3/0, Czechia 1/-1, South Africa 1/-2.
 * Final round (simultaneous, June 24): Czechia v Mexico, South Africa v South Korea.
 */
export const GROUP_A_AFTER_MD2: Group = {
  name: 'A',
  teams: [
    { id: 'MEX', name: 'Mexico' },
    { id: 'KOR', name: 'South Korea' },
    { id: 'CZE', name: 'Czechia' },
    { id: 'RSA', name: 'South Africa' },
  ],
  matches: [
    // Matchday 1
    { home: 'MEX', away: 'RSA', homeGoals: 2, awayGoals: 0 },
    { home: 'KOR', away: 'CZE', homeGoals: 2, awayGoals: 1 },
    // Matchday 2
    { home: 'CZE', away: 'RSA', homeGoals: 1, awayGoals: 1 },
    { home: 'MEX', away: 'KOR', homeGoals: 1, awayGoals: 0 },
    // Matchday 3 — not yet played
    { home: 'CZE', away: 'MEX', homeGoals: null, awayGoals: null },
    { home: 'RSA', away: 'KOR', homeGoals: null, awayGoals: null },
  ],
};
