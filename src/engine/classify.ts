import { recordFor } from './standings';
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
}

export function classifyGroup(group: Group): TeamVerdict[] {
  const teamIds = group.teams.map((t) => t.id);
  const played = playedMatches(group.matches);
  const unplayed = unplayedMatches(group.matches);
  const worlds = enumerateWorlds(unplayed);

  return group.teams.map((team) => {
    const ownIdx = unplayed
      .map((m, i) => (m.home === team.id || m.away === team.id ? i : -1))
      .filter((i) => i >= 0);
    const otherIdx = unplayed.map((_, i) => i).filter((i) => !ownIdx.includes(i));

    const evals: WorldEval[] = worlds.map((world) => {
      const wm = worldMatches(played, unplayed, world);
      const b = topTwoBoundary(team.id, teamIds, wm);
      return {
        own: ownIdx.map((i) => ownResult(unplayed[i], team.id, world[i])),
        otherOutcomes: otherIdx.map((i) => world[i]),
        status: b.status,
        tiedWith: b.tiedWith,
        wonHeadToHeadOver: b.wonHeadToHeadOver,
      };
    });

    const statuses = new Set(evals.map((e) => e.status));
    const everIn = statuses.has('in') || statuses.has('gd');
    const alwaysIn = evals.every((e) => e.status === 'in');
    const neverTop2 = !statuses.has('in') && !statuses.has('gd');

    let status: Status;
    if (alwaysIn) status = 'qualified';
    else if (neverTop2 && ownIdx.length === 0) status = 'eliminated'; // group finished, missed out
    else if (neverTop2) status = 'contention'; // best-third hopes handled at tournament level
    else status = 'contention';

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
      headline: 'Through',
      conditions: [
        { outcome: 'Through', lines: ['Already qualified. Now playing for top spot and seeding.'], guarantees: true },
      ],
      disclaims: false,
    };
  }

  if (groupFinished) {
    return {
      headline: 'Top two out of reach',
      conditions: [
        { outcome: 'Done', lines: ['Cannot finish in the top two. Only the best-third comparison can still help.'], guarantees: false },
      ],
      disclaims: false,
    };
  }

  // Endgame: exactly one own match left. Full, bulleted breakdown by W/D/L.
  if (ownIdx.length === 1) {
    const ownMatch = unplayed[ownIdx[0]];
    const conditions: Condition[] = [];
    let disclaims = false;

    for (const own of ['Win', 'Draw', 'Loss'] as OwnResult[]) {
      const subset = evals.filter((e) => e.own[0] === own);
      if (subset.length === 0) continue;
      const { lines, guarantees, usedGd } = summarizeOwn(group, own, subset, otherIdx, unplayed);
      disclaims = disclaims || usedGd;
      conditions.push({ outcome: own, lines, guarantees });
    }

    const headline = endgameHeadline(group, teamId, ownMatch, evals, otherIdx, unplayed, conditions);
    return { headline, conditions, disclaims };
  }

  // Earlier rounds (more than one own match): compute a concrete, correct target.
  return earlyRound(evals);
}

/** Summarize all sub-worlds for one own result, as bullet lines covering every path. */
function summarizeOwn(
  group: Group,
  own: OwnResult,
  subset: WorldEval[],
  otherIdx: number[],
  unplayed: { home: TeamId; away: TeamId }[],
): { lines: string[]; guarantees: boolean; usedGd: boolean } {
  const s = new Set(subset.map((e) => e.status));

  if (s.size === 1 && s.has('in')) {
    const lines = ['Through to the Round of 32.'];
    const note = headToHeadNote(group, subset);
    if (note) lines.push(note);
    return { lines, guarantees: true, usedGd: false };
  }
  if (s.size === 1 && s.has('out')) {
    return { lines: ['Out of the top two. Best-third hopes only.'], guarantees: false, usedGd: false };
  }
  if (s.size === 1 && s.has('gd')) {
    return {
      lines: [`Level on points with ${rivalNames(group, subset)}. Head-to-head is tied, so goal difference decides.`],
      guarantees: false,
      usedGd: true,
    };
  }

  // Mixed across the other match(es). One bullet per distinct other-match outcome.
  if (otherIdx.length === 1) {
    const om = unplayed[otherIdx[0]];
    const lines: string[] = [];
    for (const o of ['HOME', 'DRAW', 'AWAY'] as Outcome[]) {
      const e = subset.find((x) => x.otherOutcomes[0] === o);
      if (!e) continue;
      const cond = describeMatch(group, om, o);
      if (e.status === 'in') lines.push(`If ${cond}: through.`);
      else if (e.status === 'out') lines.push(`If ${cond}: out, best-third hopes only.`);
      else lines.push(`If ${cond}: level with ${nameList(group, e.tiedWith)}, goal difference decides.`);
    }
    return { lines, guarantees: false, usedGd: subset.some((e) => e.status === 'gd') };
  }

  return { lines: ['Depends on the other group results.'], guarantees: false, usedGd: subset.some((e) => e.status === 'gd') };
}

/** If a guaranteed result hinges on winning a points tie via head-to-head, say so:
 *  this is the 2026 rule (head-to-head ahead of goal difference) that surprises people. */
function headToHeadNote(group: Group, subset: WorldEval[]): string | null {
  const ids = new Set<TeamId>();
  for (const e of subset) for (const id of e.wonHeadToHeadOver) ids.add(id);
  if (ids.size === 0) return null;
  const names = [...ids].map((id) => nameOf(group, id)).join(' and ');
  return `Even level on points with ${names}, you finish above on head-to-head, which beats goal difference in 2026.`;
}

const nameList = (group: Group, ids: TeamId[]): string =>
  ids.map((id) => nameOf(group, id)).join(' and ') || 'a rival';

function rivalNames(group: Group, subset: WorldEval[]): string {
  const ids = new Set<TeamId>();
  for (const e of subset) for (const id of e.tiedWith) ids.add(id);
  return nameList(group, [...ids]);
}

/** Short verdict label for the one-match endgame. */
function endgameHeadline(
  group: Group,
  teamId: TeamId,
  ownMatch: { home: TeamId; away: TeamId },
  evals: WorldEval[],
  otherIdx: number[],
  unplayed: { home: TeamId; away: TeamId }[],
  conditions: Condition[],
): string {
  const win = conditions.find((c) => c.outcome === 'Win');
  const draw = conditions.find((c) => c.outcome === 'Draw');
  const winSubset = evals.filter((e) => e.own[0] === 'Win');
  const winQualifies = winSubset.some((e) => e.status === 'in' || e.status === 'gd');

  if (win?.guarantees && draw?.guarantees) return 'Win or draw to go through';
  if (win?.guarantees) return 'Win to go through';
  if (winQualifies) {
    const blocker = findBlocker(group, winSubset, otherIdx, unplayed);
    return blocker ? `Must win, and need ${blocker}` : 'Must win and hope';
  }
  return 'Best-third hopes only';
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
function earlyRound(evals: WorldEval[]): { headline: string; conditions: Condition[]; disclaims: boolean } {
  const wins = (e: WorldEval) => e.own.filter((r) => r === 'Win').length;
  const allIn = (subset: WorldEval[]) => subset.length > 0 && subset.every((e) => e.status === 'in');

  const byNextWin = evals.filter((e) => e.own[0] === 'Win');
  const byOneWin = evals.filter((e) => wins(e) >= 1);
  const byAllWin = evals.filter((e) => wins(e) === e.own.length);

  let headline: string;
  let line: string;
  if (allIn(byNextWin)) {
    headline = 'Win the next game to be safe';
    line = 'A win in the next game secures a top-two place, whatever else happens.';
  } else if (allIn(byOneWin)) {
    headline = 'One more win to be safe';
    line = 'Any win from the games left secures a top-two place.';
  } else if (allIn(byAllWin)) {
    headline = 'Win out to be safe';
    line = 'Winning every remaining game secures top two. Fewer wins may still depend on other results.';
  } else if (evals.some((e) => e.status === 'in' || e.status === 'gd')) {
    headline = 'Still in the mix';
    line = 'Can still reach the top two, but not yet on their own results alone.';
  } else {
    headline = 'Needs help';
    line = 'Cannot reach the top two without other results going their way.';
  }

  return { headline, conditions: [{ outcome: 'Target', lines: [line], guarantees: false }], disclaims: false };
}
