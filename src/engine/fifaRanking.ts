// Real FIFA/Coca-Cola Men's World Ranking order of the 48 finalists, as published
// before the 2026 finals (June 2026 edition). Rule 8 uses the pre-tournament
// ranking, which is a fixed list, so this is hardcoded. Only the relative order
// matters. Source: FIFA ranking June 2026 (via ESPN / Yahoo Sports summaries).
// Names match the openfootball feed (e.g. "Czech Republic", "Bosnia & Herzegovina").
const ORDER: string[] = [
  'Argentina',
  'Spain',
  'France',
  'England',
  'Portugal',
  'Brazil',
  'Morocco',
  'Netherlands',
  'Belgium',
  'Germany',
  'Croatia',
  'Colombia',
  'Mexico',
  'Senegal',
  'Uruguay',
  'USA',
  'Japan',
  'Switzerland',
  'Iran',
  'Turkey',
  'Ecuador',
  'Austria',
  'South Korea',
  'Australia',
  'Algeria',
  'Egypt',
  'Canada',
  'Norway',
  'Ivory Coast',
  'Panama',
  'Sweden',
  'Czech Republic',
  'Paraguay',
  'Scotland',
  'Tunisia',
  'DR Congo',
  'Uzbekistan',
  'Qatar',
  'Iraq',
  'South Africa',
  'Saudi Arabia',
  'Jordan',
  'Bosnia & Herzegovina',
  'Cape Verde',
  'Ghana',
  'Curaçao',
  'Haiti',
  'New Zealand',
];

const RANK = new Map<string, number>(ORDER.map((name, i) => [name, i + 1]));

/** FIFA ranking position (1 = best). Unknown teams rank last. ids equal team names. */
export function fifaRankOf(idOrName: string): number {
  return RANK.get(idOrName) ?? 999;
}
