// Approximate pre-tournament FIFA/Coca-Cola Men's World Ranking order for the 48
// finalists. Rule 8 uses the ranking PUBLISHED BEFORE the tournament, which is a
// fixed list, so bundling a snapshot is correct (no live data needed). Used only as
// the last-resort tiebreaker when teams are level through criteria 1-6, which is
// astronomically rare. Order is approximate and easy to update.
const ORDER: string[] = [
  'Argentina',
  'Spain',
  'France',
  'England',
  'Brazil',
  'Portugal',
  'Netherlands',
  'Belgium',
  'Germany',
  'Croatia',
  'Morocco',
  'Colombia',
  'Mexico',
  'USA',
  'Uruguay',
  'Switzerland',
  'Japan',
  'Senegal',
  'Iran',
  'South Korea',
  'Ecuador',
  'Austria',
  'Australia',
  'Canada',
  'Turkey',
  'Egypt',
  'Norway',
  'Panama',
  'Ivory Coast',
  'Scotland',
  'Sweden',
  'Tunisia',
  'Czech Republic',
  'Algeria',
  'Paraguay',
  'Qatar',
  'Saudi Arabia',
  'DR Congo',
  'South Africa',
  'Iraq',
  'Jordan',
  'Bosnia & Herzegovina',
  'Ghana',
  'Uzbekistan',
  'New Zealand',
  'Cape Verde',
  'Curaçao',
  'Haiti',
];

const RANK = new Map<string, number>(ORDER.map((name, i) => [name, i + 1]));

/** FIFA ranking position (1 = best). Unknown teams rank last. ids equal team names. */
export function fifaRankOf(idOrName: string): number {
  return RANK.get(idOrName) ?? 999;
}
