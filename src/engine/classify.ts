import { recordFor } from './standings';
import { rankGroup } from './tiebreak';
import {
  enumerateWorlds,
  playedMatches,
  topTwoBoundary,
  unplayedMatches,
  worldMatches,
  type BoundaryStatus,
  type Outcome,
} from './worlds';
import type { Condition, Group, Status, TeamId, TeamVerdict } from './types';

const nameOf = (g: Group, id: TeamId) => g.teams.find((t) => t.id === id)!.name;

/** A team's own result in a match, from its perspective. */
type OwnResult = 'Win' | 'Draw' | 'Loss';

function ownResult(m: { home: TeamId; away: TeamId }, teamId: TeamId, o: Outcome): OwnResult {
  const isHome = m.home === teamId;
  if (o === 'DRAW') return 'Draw';
  const homeWon = o === 'HOME';
  return homeWon === isHome ? 'Win' : 'Loss';
}

/** Describe a single other match's outcome in plain English, e.g. "Czechia beat Mexico". */
function describeMatch(g: Group, m: { home: TeamId; away: TeamId }, o: Outcome): string {
  const h = nameOf(g, m.home);
  const a = nameOf(g, m.away);
  if (o === 'DRAW') return `${h} and ${a} draw`;
  return o === 'HOME' ? `${h} beat ${a}` : `${a} beat ${h}`;
}

interface WorldEval {
  own: OwnResult[]; // team's own results, one per own unplayed match
  otherOutcomes: Outcome[]; // outcomes of the other unplayed matches
  status: BoundaryStatus;
  tiedWith: TeamId[];
  wonHeadToHeadOver: TeamId[];
  aheadOnLockedGd: TeamId[];
}

export function classifyGroup(group: Group): TeamVerdict[] {
  const teamIds = group.teams.map((t) => t.id);
  const played = playedMatches(group.matches);
  const unplayed = unplayedMatches(group.matches);
  const worlds = enumerateWorlds(unplayed);
  const groupFinished = unplayed.length === 0;

  // When the group is over, goal difference and FIFA ranking are real, so the final
  // positions are exact: the top two qualify, full stop. Rank once and use it for
  // status, so a 2nd-place team decided on GD/ranking isn't left as "contention".
  const finalRank = groupFinished ? rankGroup(teamIds, group.matches).ordered : null;
  const finishedPos = (id: TeamId) => (finalRank ? finalRank.indexOf(id) : -1);

  return group.teams.map((team) => {
    const ownIdx = unplayed
      .map((m, i) => (m.home === team.id || m.away === team.id ? i : -1))
      .filter((i) => i >= 0);
    const otherIdx = unplayed.map((_, i) => i).filter((i) => !ownIdx.includes(i));

    const evals: WorldEval[] = worlds.map((world) => {
      const wm = worldMatches(played, unplayed, world);
      // A team's final GD is locked unless a remaining game of its could still move
      // it. A draw adds 0 to GD, so a draw doesn't unlock; only a win/loss does.
      const gdLocked = new Set(teamIds);
      unplayed.forEach((mt, i) => {
        if (world[i] !== 'DRAW') {
          gdLocked.delete(mt.home);
          gdLocked.delete(mt.away);
        }
      });
      const b = topTwoBoundary(team.id, teamIds, wm, 2, gdLocked);
      return {
        own: ownIdx.map((i) => ownResult(unplayed[i], team.id, world[i])),
        otherOutcomes: otherIdx.map((i) => world[i]),
        status: b.status,
        tiedWith: b.tiedWith,
        wonHeadToHeadOver: b.wonHeadToHeadOver,
        aheadOnLockedGd: b.aheadOnLockedGd,
      };
    });

    // Elimination is decided at the tournament level (it needs cross-group info),
    // so here a team is only "qualified" (top 2) or "contention". For a finished
    // group, "top 2" is the exact final position; otherwise it's "top 2 in every world".
    const pos = finishedPos(team.id);
    const status: Status =
      (groupFinished ? pos < 2 : evals.every((e) => e.status === 'in')) ? 'qualified' : 'contention';

    const topTwoWorldFraction =
      evals.filter((e) => e.status === 'in' || e.status === 'gd').length / evals.length;

    const { headline, conditions, disclaims } = describe(
      group,
      team.id,
      evals,
      ownIdx,
      otherIdx,
      unplayed,
      status,
      played.length === group.matches.length,
    );

    return {
      teamId: team.id,
      teamName: team.name,
      groupName: group.name,
      status,
      headline,
      conditions,
      bestThird: null,
      disclaimsDeepTiebreak: disclaims,
      topTwoWorldFraction,
    };
  });
}

function describe(
  group: Group,
  teamId: TeamId,
  evals: WorldEval[],
  ownIdx: number[],
  otherIdx: number[],
  unplayed: { home: TeamId; away: TeamId }[],
  status: Status,
  groupFinished: boolean,
): { headline: string; conditions: Condition[]; disclaims: boolean } {
  if (status === 'qualified') {
    return {
      headline: 'Qualified',
      conditions: [
        {
          outcome: 'Qualified',
          lines: ['Qualified for the Round of 32'],
          note: groupFinished ? undefined : 'Still playing for top spot and seeding',
          guarantees: true,
        },
      ],
      disclaims: false,
    };
  }

  if (groupFinished) {
    return {
      headline: 'Top two out of reach',
      conditions: [
        { outcome: 'Done', lines: ["Can't finish top two, only the best third spots can still help"], guarantees: false },
      ],
      disclaims: false,
    };
  }

  // Team has played all its games but the group has not finished. Its fate is fixed
  // by the remaining matches, so compute the verdict from those rather than bailing.
  if (ownIdx.length === 0) {
    const { lines, note, usedGd } = summarizeOwn(group, evals, otherIdx, unplayed);
    const alive = evals.some((e) => e.status === 'in' || e.status === 'gd');
    const headline = !alive
      ? 'Best third hopes only'
      : otherIdx.length === 1
        ? 'Comes down to the last game'
        : 'Down to the other results';
    return { headline, conditions: [{ outcome: 'Result', lines, note, guarantees: false }], disclaims: usedGd };
  }

  // Endgame: exactly one own match left. Full breakdown by W/D/L.
  if (ownIdx.length === 1) {
    const ownMatch = unplayed[ownIdx[0]];
    const conditions: Condition[] = [];
    let disclaims = false;

    for (const own of ['Win', 'Draw', 'Loss'] as OwnResult[]) {
      const subset = evals.filter((e) => e.own[0] === own);
      if (subset.length === 0) continue;
      const { lines, note, guarantees, usedGd } = summarizeOwn(group, subset, otherIdx, unplayed);
      disclaims = disclaims || usedGd;
      conditions.push({ outcome: own, lines, note, guarantees });
    }

    const headline = endgameHeadline(group, teamId, ownMatch, evals, otherIdx, unplayed);
    return { headline, conditions, disclaims };
  }

  // Earlier rounds (more than one own match): too early for a sharp verdict.
  return earlyRound();
}

const opponentName = (group: Group, m: { home: TeamId; away: TeamId }, teamId: TeamId): string =>
  nameOf(group, m.home === teamId ? m.away : m.home);

/** Summarize all sub-worlds for one own result, covering every path. */
function summarizeOwn(
  group: Group,
  subset: WorldEval[],
  otherIdx: number[],
  unplayed: { home: TeamId; away: TeamId }[],
): { lines: string[]; note?: string; guarantees: boolean; usedGd: boolean } {
  const s = new Set(subset.map((e) => e.status));

  if (s.size === 1 && s.has('in')) {
    const note = headToHeadNote(group, subset) ?? lockedGdNote(group, subset);
    return { lines: ['Qualified for the Round of 32'], note, guarantees: true, usedGd: false };
  }
  if (s.size === 1 && s.has('out')) {
    return { lines: ['Out from top two. Only hope for best third'], guarantees: false, usedGd: false };
  }
  if (s.size === 1 && s.has('gd')) {
    return {
      lines: [`Level on points with ${rivalNames(group, subset)}, head to head is level too, so goal difference decides`],
      guarantees: false,
      usedGd: true,
    };
  }

  // Mixed across the other match. One line per distinct other-match outcome.
  if (otherIdx.length === 1) {
    const om = unplayed[otherIdx[0]];
    const lines: string[] = [];
    for (const o of ['HOME', 'DRAW', 'AWAY'] as Outcome[]) {
      const e = subset.find((x) => x.otherOutcomes[0] === o);
      if (!e) continue;
      const cond = describeMatch(group, om, o);
      if (e.status === 'in') lines.push(`If ${cond}, qualifies`);
      else if (e.status === 'out') lines.push(`If ${cond}, out (best third only)`);
      else lines.push(`If ${cond}, level with ${nameList(group, e.tiedWith)}, goal difference decides`);
    }
    return { lines, guarantees: false, usedGd: subset.some((e) => e.status === 'gd') };
  }

  return { lines: ['Depends on the other group results'], guarantees: false, usedGd: subset.some((e) => e.status === 'gd') };
}

/** If a guaranteed result hinges on winning a points tie via head-to-head, say so:
 *  this is the 2026 rule (head-to-head ahead of goal difference) that surprises people. */
function headToHeadNote(group: Group, subset: WorldEval[]): string | undefined {
  const ids = new Set<TeamId>();
  for (const e of subset) for (const id of e.wonHeadToHeadOver) ids.add(id);
  if (ids.size === 0) return undefined;
  const names = [...ids].map((id) => nameOf(group, id)).join(' and ');
  return `Won the head to head with ${names} (tiebreaker 2)`;
}

/** When a result is enough because of an already-locked goal difference (a draw
 *  can't move the gap), explain it. */
function lockedGdNote(group: Group, subset: WorldEval[]): string | undefined {
  const ids = new Set<TeamId>();
  for (const e of subset) for (const id of e.aheadOnLockedGd) ids.add(id);
  if (ids.size === 0) return undefined;
  const names = [...ids].map((id) => nameOf(group, id)).join(' and ');
  return `Ahead of ${names} on goal difference, and a draw can't change that`;
}

const nameList = (group: Group, ids: TeamId[]): string =>
  ids.map((id) => nameOf(group, id)).join(' and ') || 'a rival';

function rivalNames(group: Group, subset: WorldEval[]): string {
  const ids = new Set<TeamId>();
  for (const e of subset) for (const id of e.tiedWith) ids.add(id);
  return nameList(group, [...ids]);
}

/** Short verdict label for the one-match endgame, naming the opponent. */
function endgameHeadline(
  group: Group,
  teamId: TeamId,
  ownMatch: { home: TeamId; away: TeamId },
  evals: WorldEval[],
  otherIdx: number[],
  unplayed: { home: TeamId; away: TeamId }[],
): string {
  const opp = opponentName(group, ownMatch, teamId);
  const winSub = evals.filter((e) => e.own[0] === 'Win');
  const drawSub = evals.filter((e) => e.own[0] === 'Draw');
  const allIn = (s: WorldEval[]) => s.length > 0 && s.every((e) => e.status === 'in');
  const neverOut = (s: WorldEval[]) => s.length > 0 && s.every((e) => e.status !== 'out');
  const winQualifies = winSub.some((e) => e.status === 'in' || e.status === 'gd');

  if (allIn(winSub) && allIn(drawSub)) return `Win or draw vs ${opp}`;
  if (allIn(winSub)) return `Beat ${opp} to qualify`;
  if (neverOut(winSub)) return `Beat ${opp}, goal difference may decide`;
  if (winQualifies) {
    const blocker = findBlocker(group, winSub, otherIdx, unplayed);
    return blocker ? `Beat ${opp}, and need ${blocker}` : `Beat ${opp} and hope`;
  }
  return 'Best third hopes only';
}

/** When even a win is not enough, name what the team needs from the other match. */
function findBlocker(
  group: Group,
  winSubset: WorldEval[],
  otherIdx: number[],
  unplayed: { home: TeamId; away: TeamId }[],
): string | null {
  if (otherIdx.length !== 1) return null;
  const om = unplayed[otherIdx[0]];
  const good = (o: Outcome) => {
    const e = winSubset.find((x) => x.otherOutcomes[0] === o);
    return !!e && e.status !== 'out';
  };
  const gH = good('HOME');
  const gD = good('DRAW');
  const gA = good('AWAY');
  const h = nameOf(group, om.home);
  const a = nameOf(group, om.away);
  if (gH && !gD && !gA) return `${a} to lose`;
  if (gA && !gD && !gH) return `${h} to lose`;
  if (gH && gD && !gA) return `${a} to slip up`;
  if (gA && gD && !gH) return `${h} to slip up`;
  return null;
}

/** Concrete target for teams with more than one match left. Only claims a
 *  guarantee when enumeration confirms it holds in every world. */
function earlyRound(): { headline: string; conditions: Condition[]; disclaims: boolean } {
  // With two or more games still to play it is too early for a sharp verdict, so
  // the app says so plainly rather than over-stating an outlook.
  return {
    headline: 'Need more games',
    conditions: [
      { outcome: 'Too early', lines: ['Need more games to calculate a clear verdict.'], guarantees: false },
    ],
    disclaims: false,
  };
}
