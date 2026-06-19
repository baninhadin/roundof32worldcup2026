// Team name -> ISO 3166-1 alpha-2 (or gb-eng/gb-sct) for flagcdn.com.
// Windows/Chrome don't render regional-indicator flag emoji, so we use images.
const CODES: Record<string, string> = {
  Algeria: 'dz',
  Argentina: 'ar',
  Australia: 'au',
  Austria: 'at',
  Belgium: 'be',
  'Bosnia & Herzegovina': 'ba',
  Brazil: 'br',
  Canada: 'ca',
  'Cape Verde': 'cv',
  Colombia: 'co',
  Croatia: 'hr',
  'Curaçao': 'cw',
  'Czech Republic': 'cz',
  'DR Congo': 'cd',
  Ecuador: 'ec',
  Egypt: 'eg',
  England: 'gb-eng',
  France: 'fr',
  Germany: 'de',
  Ghana: 'gh',
  Haiti: 'ht',
  Iran: 'ir',
  Iraq: 'iq',
  'Ivory Coast': 'ci',
  Japan: 'jp',
  Jordan: 'jo',
  Mexico: 'mx',
  Morocco: 'ma',
  Netherlands: 'nl',
  'New Zealand': 'nz',
  Norway: 'no',
  Panama: 'pa',
  Paraguay: 'py',
  Portugal: 'pt',
  Qatar: 'qa',
  'Saudi Arabia': 'sa',
  Scotland: 'gb-sct',
  Senegal: 'sn',
  'South Africa': 'za',
  'South Korea': 'kr',
  Spain: 'es',
  Sweden: 'se',
  Switzerland: 'ch',
  Tunisia: 'tn',
  Turkey: 'tr',
  USA: 'us',
  Uruguay: 'uy',
  Uzbekistan: 'uz',
};

export function flagCode(teamName: string): string | null {
  return CODES[teamName] ?? null;
}

/** flag-icons CSS class for a team (bundled offline SVGs), or null if unmapped. */
export function flagClass(teamName: string): string | null {
  const code = flagCode(teamName);
  return code ? `fi fi-${code}` : null;
}
