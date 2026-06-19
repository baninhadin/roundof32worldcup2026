import type { Match, Record, TeamId } from './types';

const isPlayed = (m: Match): boolean => m.homeGoals !== null && m.awayGoals !== null;

/** Build a team's record over the given matches. Unplayed matches are ignored.
 *  `restrictTo`, if provided, counts only matches between teams in that set
 *  (used for head-to-head sub-tables). */
export function recordFor(
  teamId: TeamId,
  matches: Match[],
  restrictTo?: Set<TeamId>,
): Record {
  const r: Record = {
    teamId,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDiff: 0,
    points: 0,
  };

  for (const m of matches) {
    if (!isPlayed(m)) continue;
    if (m.home !== teamId && m.away !== teamId) continue;
    if (restrictTo && (!restrictTo.has(m.home) || !restrictTo.has(m.away))) continue;

    const isHome = m.home === teamId;
    const gf = (isHome ? m.homeGoals : m.awayGoals) as number;
    const ga = (isHome ? m.awayGoals : m.homeGoals) as number;

    r.played++;
    r.goalsFor += gf;
    r.goalsAgainst += ga;
    if (gf > ga) {
      r.won++;
      r.points += 3;
    } else if (gf === ga) {
      r.drawn++;
      r.points += 1;
    } else {
      r.lost++;
    }
  }

  r.goalDiff = r.goalsFor - r.goalsAgainst;
  return r;
}

export function recordsFor(
  teamIds: TeamId[],
  matches: Match[],
  restrictTo?: Set<TeamId>,
): Map<TeamId, Record> {
  const out = new Map<TeamId, Record>();
  for (const id of teamIds) out.set(id, recordFor(id, matches, restrictTo));
  return out;
}
