// Core data model for the qualification engine.
// Everything downstream is derived from Team[] + Match[] — no hidden state.

export type TeamId = string;

export interface Team {
  id: TeamId;
  name: string;
}

/** A single group fixture. Goals are null until the match is played. */
export interface Match {
  home: TeamId;
  away: TeamId;
  homeGoals: number | null;
  awayGoals: number | null;
}

export interface Group {
  /** Single letter A–L. */
  name: string;
  teams: Team[];
  matches: Match[];
}

/** A team's aggregate record over a set of matches (whole group, or head-to-head subset). */
export interface Record {
  teamId: TeamId;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
}

/**
 * Top-2 qualification status for a team, computed exactly by enumerating all
 * remaining within-group result combinations.
 *  - "qualified"   : top 2 in EVERY remaining world (guaranteed through).
 *  - "eliminated"  : top 2 in NO world AND cannot back-door as a best third.
 *  - "contention"  : neither — fate still open (incl. best-third-only hopes).
 */
export type Status = 'qualified' | 'eliminated' | 'contention';

/**
 * One readable conditional path, grouped by the team's OWN remaining result.
 * `detail` is the plain-English consequence; `outcome` is what they must do.
 */
export interface Condition {
  /** Short tag for the team's own result, e.g. "Win", "Draw", "Loss", "Target". */
  outcome: string;
  /** One or more plain lines covering every path for this result. */
  lines: string[];
  /** Optional secondary explanation, shown muted below the lines (not a branch). */
  note?: string;
  /** Whether this path guarantees a top-2 place (vs conditional on others / GD). */
  guarantees: boolean;
}

export interface BestThirdSnapshot {
  /** Current rank among the 12 third-placed teams (1 = best). */
  rank: number;
  /** Top this many thirds advance (8). */
  cutoff: number;
  /** Whether the team would currently advance as a best third. */
  currentlyIn: boolean;
}

export interface TeamVerdict {
  teamId: TeamId;
  teamName: string;
  groupName: string;
  status: Status;
  /** One-line plain verdict (the headline). */
  headline: string;
  /** Complete, grouped conditional paths (clarity AND completeness). */
  conditions: Condition[];
  /** Live snapshot of best-third standing IF relevant to this team, else null. */
  bestThird: BestThirdSnapshot | null;
  /**
   * True if a surviving tie could only be broken by criteria 7–8 (conduct /
   * FIFA ranking), which v1 does not compute. Surfaced as an honest disclaimer.
   */
  disclaimsDeepTiebreak: boolean;
  /** Internal: fraction of equally-weighted worlds where the team makes top 2.
   *  Kept for a future naive-% feature; not surfaced in v1 UI. */
  topTwoWorldFraction: number;
}
