// The 2026 qualification + tiebreaker rules, surfaced in the UI with sources.

export interface RuleSource {
  label: string;
  url: string;
}

export const FORMAT_RULES: string[] = [
  '48 teams in 12 groups (A–L) of 4. Each team plays the other three once.',
  'The top 2 of every group advance — 24 teams.',
  'The 8 best third-placed teams across all 12 groups also advance.',
  'That makes 32 teams in the Round of 32 knockout bracket.',
];

/** Within-group ranking, in 2026 order. Head-to-head moved AHEAD of goal
 *  difference for 2026, and drawing of lots was removed. */
export const GROUP_TIEBREAKERS: { n: number; text: string; v1: boolean }[] = [
  { n: 1, text: 'Most points in all group matches', v1: true },
  { n: 2, text: 'Head-to-head points among the tied teams  (NEW for 2026 — now ahead of goal difference)', v1: true },
  { n: 3, text: 'Head-to-head goal difference among the tied teams', v1: true },
  { n: 4, text: 'Head-to-head goals scored among the tied teams', v1: true },
  { n: 5, text: 'Overall goal difference', v1: true },
  { n: 6, text: 'Overall goals scored', v1: true },
  { n: 7, text: 'Fair-play / conduct score (fewest disciplinary points)', v1: false },
  { n: 8, text: 'FIFA World Ranking  (replaces drawing of lots, removed for 2026)', v1: false },
];

export const BEST_THIRD_TIEBREAKERS: string[] = [
  'Most points',
  'Overall goal difference',
  'Overall goals scored',
  'Fair-play / conduct score',
  'FIFA World Ranking',
];

export const RULE_SOURCES: RuleSource[] = [
  {
    label: 'FIFA — official 2026 groups & tie-breakers',
    url: 'https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/groups-how-teams-qualify-tie-breakers',
  },
  {
    label: 'ESPN — 2026 group-stage advancement & tiebreakers',
    url: 'https://www.espn.com/soccer/story/_/id/49031236/2026-world-cup-group-stage-clinching-scenarios-knockout-rounds-elimination',
  },
  {
    label: 'FOX Sports — group-stage & third-place tiebreakers',
    url: 'https://www.foxsports.com/stories/soccer/fifa-world-cup-group-stage-third-place-tiebreakers',
  },
  {
    label: 'SofaScore — new 2026 tiebreaker rules explained',
    url: 'https://www.sofascore.com/news/__trashed-21',
  },
  {
    label: 'Data: openfootball / worldcup.json',
    url: 'https://github.com/openfootball/worldcup.json',
  },
];
