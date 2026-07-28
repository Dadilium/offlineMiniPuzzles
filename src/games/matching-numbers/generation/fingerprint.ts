import type { GridValue } from '../types';

/**
 * Cheap shape signature to avoid serving a near-duplicate board twice in a
 * row -- not canonical, just good enough for a recent-history de-dup set.
 * Mirrors Kings' fingerprintRegions: a value-count multiset (catches
 * near-identical boards regardless of exact position) plus a rolling hash
 * (catches near-exact repeats).
 */
export function fingerprintGrid(grid: GridValue[][]): string {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const counts = new Array(10).fill(0); // index 0 = empty cells, 1-9 = digit counts
  let hash = 0;
  for (const row of grid) {
    for (const v of row) {
      const bucket = v === null ? 0 : v;
      counts[bucket]++;
      hash = (hash * 31 + bucket + 1) | 0;
    }
  }
  return `${rows}x${cols}:${counts.join(',')}:${hash}`;
}
