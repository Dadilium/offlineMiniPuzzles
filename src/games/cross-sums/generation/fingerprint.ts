/**
 * Cheap shape signature for a board: dimensions + a rolling hash of the raw
 * digit grid + the row/col target lists. Not a canonical form -- just good
 * enough to keep a rolling recent-levels history from serving the
 * same-looking board twice in a row.
 */
export function fingerprintCrossSums(grid: number[][], rowTargets: number[], colTargets: number[]): string {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  let hash = 0;
  for (const row of grid) {
    for (const v of row) {
      hash = (hash * 31 + v + 1) | 0;
    }
  }
  return `${rows}x${cols}:${hash}:${rowTargets.join(',')}:${colTargets.join(',')}`;
}
