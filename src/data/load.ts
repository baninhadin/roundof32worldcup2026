import type { Group } from '@/engine/types';
import { toGroups } from './adapter';
import snapshot from './worldcup2026.snapshot.json';

const LIVE_URL =
  'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';

export interface LoadResult {
  groups: Group[];
  /** Where the data came from, surfaced honestly in the UI. */
  source: 'live' | 'bundled';
  /** When the data was fetched (live), null for the bundled snapshot. */
  fetchedAt: Date | null;
}

/** The bundled fallback, always available so the demo can never show empty. */
export function bundledGroups(): LoadResult {
  return { groups: toGroups(snapshot as never), source: 'bundled', fetchedAt: null };
}

/** One live attempt. Resolves to a LoadResult on success, or null on any failure. */
async function fetchLiveOnce(timeoutMs: number): Promise<LoadResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(LIVE_URL, { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const groups = toGroups(json);
    if (groups.length === 0) throw new Error('no groups parsed');
    return { groups, source: 'live', fetchedAt: new Date() };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch the latest openfootball data client-side, falling back to the bundled
 * snapshot. Each attempt is RACED against a hard timeout so that even if the
 * browser's fetch never settles (some restricted networks ignore abort), this
 * still resolves and the UI never gets stuck on "checking".
 */
export async function loadGroups(perTryMs = 3000, tries = 2): Promise<LoadResult> {
  for (let i = 0; i < tries; i++) {
    const result = await Promise.race<LoadResult | null>([
      fetchLiveOnce(perTryMs),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), perTryMs + 250)),
    ]);
    if (result) return result;
  }
  return bundledGroups();
}
