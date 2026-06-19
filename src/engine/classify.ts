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
  const me = nameOf(group, teamId);

  if (status === 'qualified') {
    return {
      headline: `${me} are through to the Round of 32.`,
      conditions: [{ outcome: 'Guaranteed', detail: 'Already qualified — now playing for top spot and seeding.', guarantees: true }],
      disclaims: false,
    };
  }

  if (groupFinished) {
    // No matches left; status reflects final standing (handled with best-thirds elsewhere).
    return {
      headline: `${me} cannot finish in the top two of the group.`,
      conditions: [{ outcome: 'Group finished', detail: 'Top-two route closed; only the best-third comparison can still rescue them.', guarantees: false }],
      disclaims: false,
    };
  }

  // Endgame: exactly one own match left -> rich, complete prose grouped by W/D/L.
  if (ownIdx.length === 1) {
    const ownMatch = unplayed[ownIdx[0]];
    const conditions: Condition[] = [];
    let disclaims = false;

    for (const own of ['Win', 'Draw', 'Loss'] as OwnResult[]) {
      const subset = evals.filter((e) => e.own[0] === own);
      if (subset.length === 0) continue;
      const { detail, guarantees, usedGd } = summarizeOwn(group, teamId, own, subset, otherIdx, unplayed);
      disclaims = disclaims || usedGd;
      conditions.push({ outcome: own, detail, guarantees });
    }

    const headline = buildHeadline(group, teamId, ownMatch, conditions);
    return { headline, conditions, disclaims };
  }

  // Earlier rounds (more than one own match): give a correct, honest summary
  // without enumerating every multi-match combination in prose.
  const canWin = evals.some((e) => e.status === 'in' || e.status === 'gd');
  const mustChase = evals.every((e) => e.status !== 'in');
  const headline = canWin
    ? `${me} still control their own fate with games in hand.`
    : `${me} need results to go their way over the remaining matches.`;
  return {
    headline,
    conditions: [
      {
        outcome: 'Several games left',
        detail: mustChase
          ? 'Cannot yet clinch a top-two place by themselves; depends on other results too.'
          : 'A strong finish can still secure a top-two place; exact requirements sharpen after the next round.',
        guarantees: false,
      },
    ],
    disclaims: false,
  };
}

/** Summarize all sub-worlds for one own result (Win/Draw/Loss), covering every path. */
function summarizeOwn(
  group: Group,
  teamId: TeamId,
  own: OwnResult,
  subset: WorldEval[],
  otherIdx: number[],
  unplayed: { home: TeamId; away: TeamId }[],
): { detail: string; guarantees: boolean; usedGd: boolean } {
  const s = new Set(subset.map((e) => e.status));

  if (s.size === 1 && s.has('in')) {
    const hh = headToHeadNote(group, subset);
    return { detail: `through to the Round of 32${hh}`, guarantees: true, usedGd: false };
  }
  if (s.size === 1 && s.has('out')) {
    return { detail: `top-two route closed — best-third hopes only.`, guarantees: false, usedGd: false };
  }
  if (s.size === 1 && s.has('gd')) {
    const rivals = rivalNames(group, subset);
    return {
      detail: `level on points with ${rivals}; head-to-head is tied, so overall goal difference decides it.`,
      guarantees: false,
      usedGd: true,
    };
  }

  // Mixed across the other match(es). Describe each distinct other-result path.
  // Endgame normally has exactly one other match -> describe its three outcomes.
  if (otherIdx.length === 1) {
    const om = unplayed[otherIdx[0]];
    const parts: string[] = [];
    for (const o of ['HOME', 'DRAW', 'AWAY'] as Outcome[]) {
      const e = subset.find((x) => x.otherOutcomes[0] === o);
      if (!e) continue;
      const cond = describeMatch(group, om, o);
      if (e.status === 'in') parts.push(`if ${cond}, through`);
      else if (e.status === 'out') parts.push(`if ${cond}, out (best-third hopes only)`);
      else parts.push(`if ${cond}, level on points and goal difference decides`);
    }
    const usedGd = subset.some((e) => e.status === 'gd');
    return { detail: `${parts.join('; ')}.`, guarantees: false, usedGd };
  }

  // Generic fallback for multiple other matches.
  const usedGd = subset.some((e) => e.status === 'gd');
  return {
    detail: `qualification depends on the other group results.`,
    guarantees: false,
    usedGd,
  };
}

/** If a guaranteed-through result depends on winning a points tie via head-to-head,
 *  explain it — this is the 2026 H2H-ahead-of-GD rule that surprises people. */
function headToHeadNote(group: Group, subset: WorldEval[]): string {
  const ids = new Set<TeamId>();
  for (const e of subset) for (const id of e.wonHeadToHeadOver) ids.add(id);
  if (ids.size === 0) return '.';
  const names = [...ids].map((id) => nameOf(group, id)).join(' and ');
  return ` — even level on points with ${names}, you finish above on head-to-head (which outranks goal difference in 2026).`;
}

function rivalNames(group: Group, subset: WorldEval[]): string {
  const ids = new Set<TeamId>();
  for (const e of subset) for (const id of e.tiedWith) ids.add(id);
  const names = [...ids].map((id) => nameOf(group, id));
  return names.length ? names.join(' and ') : 'a rival';
}

function buildHeadline(
  group: Group,
  teamId: TeamId,
  ownMatch: { home: TeamId; away: TeamId },
  conditions: Condition[],
): string {
  const me = nameOf(group, teamId);
  const opp = nameOf(group, ownMatch.home === teamId ? ownMatch.away : ownMatch.home);
  const byOutcome = (o: OwnResult) => conditions.find((c) => c.outcome === o);
  const win = byOutcome('Win');
  const draw = byOutcome('Draw');

  const winThrough = win?.guarantees;
  const drawThrough = draw?.guarantees;

  if (winThrough && drawThrough) return `${me} go through with a win or a draw against ${opp}.`;
  if (winThrough) return `${me} must beat ${opp} to be sure of going through.`;
  if (draw && win && !winThrough)
    return `${me} need to beat ${opp} — and even then need other results to fall their way.`;
  return `${me} must beat ${opp} and hope other results go their way.`;
}
