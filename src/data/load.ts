import type { Group } from '@/engine/types';
import { toGroups } from './adapter';
import snapshot from './worldcup2026.snapshot.json';

const LIVE_URL =
  'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';

export interface LoadResult {
  groups: Group[];
  /** Where the data came from, surfaced honestly in the UI. */
  source: 'live' | 'bundled';
  /** When the data was fetched (live) — null for the bundled snapshot. */
  fetchedAt: Date | null;
}

/** The bundled fallback — always available so the demo can never show empty. */
export function bundledGroups(): LoadResult {
  return { groups: toGroups(snapshot as never), source: 'bundled', fetchedAt: null };
}

/**
 * Fetch the latest openfootball data client-side; fall back to the bundled
 * snapshot on any failure (offline, rate-limit, schema drift). "Live" is only
 * as fresh as the community-updated source, which is stated in the UI.
 */
export async function loadGroups(timeoutMs = 6000): Promise<LoadResult> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(LIVE_URL, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const groups = toGroups(json);
    if (groups.length === 0) throw new Error('no groups parsed');
    return { groups, source: 'live', fetchedAt: new Date() };
  } catch {
    return bundledGroups();
  }
}
