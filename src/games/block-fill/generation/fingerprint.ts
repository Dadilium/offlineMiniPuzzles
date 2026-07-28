/**
 * Cheap shape signature for a board layout: dimensions + fillable-cell count
 * + a rolling hash of the fillable grid. Not canonical -- just good enough to
 * keep a rolling recent-levels history from serving the same-looking board
 * twice in a row. Mirrors Kings' `fingerprintRegions` / Matching Numbers'
 * `fingerprintGrid`.
 */
export function fingerprintBlockFill(fillable: boolean[][]): string {
  const rows = fillable.length;
  const cols = fillable[0]?.length ?? 0;
  let fillableCount = 0;
  let hash = 0;
  for (const row of fillable) {
    for (const v of row) {
      if (v) fillableCount++;
      hash = (hash * 31 + (v ? 1 : 0)) | 0;
    }
  }
  return `${rows}x${cols}:${fillableCount}:${hash}`;
}
