import type { KingsLevel } from '../types';

export interface KingsSolution {
  positions: Array<{ r: number; c: number }>;
}

/** Offsets of the 8 cells a king attacks -- placing one blocks all of them. */
const NEIGHBOR_OFFSETS: Array<[number, number]> = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

/**
 * Enumerates valid king placements (one per row/column/region, no two
 * touching -- including diagonally), stopping once `cap` solutions are
 * found. Same rules as `computeKingsState` in the app's kings/engine.ts.
 *
 * Hot path of generation (most random layouts are rejected here as
 * non-unique), so it branches on the most-constrained region first (fewest
 * cells still open) and fails a branch the moment any unused region has no
 * open cell left -- far fewer nodes than plain row-by-row backtracking.
 * Rows/columns/regions in use are bitmasks (n <= 31) and king adjacency is a
 * per-cell block counter, so open-cell checks are a few integer ops.
 * Branching order doesn't affect results: a unique board has exactly one
 * solution regardless, and callers only ever compare the count against 1.
 * Positions are returned sorted by row.
 */
export function solveKings(level: KingsLevel, cap = 2): KingsSolution[] {
  const n = level.n;
  const solutions: KingsSolution[] = [];
  const cellsByRegion: number[][] = Array.from({ length: n }, () => []);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const region = level.regions[r][c];
      if (region < 0 || region >= n) return solutions; // malformed partition -- nothing valid to find
      cellsByRegion[region].push(r * n + c);
    }
  }

  const blocked = new Uint8Array(n * n);
  const placedCols = new Int32Array(n); // col of the king in row r, while placed
  let rowMask = 0;
  let colMask = 0;
  let regionMask = 0;

  const isOpen = (cell: number): boolean => {
    const r = (cell / n) | 0;
    const c = cell - r * n;
    return ((rowMask >> r) & 1) === 0 && ((colMask >> c) & 1) === 0 && blocked[cell] === 0;
  };

  const adjust = (cell: number, delta: number): void => {
    const r = (cell / n) | 0;
    const c = cell - r * n;
    for (const [dr, dc] of NEIGHBOR_OFFSETS) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < n && cc >= 0 && cc < n) blocked[rr * n + cc] += delta;
    }
  };

  function search(placed: number): void {
    if (placed === n) {
      const positions: Array<{ r: number; c: number }> = [];
      for (let r = 0; r < n; r++) positions.push({ r, c: placedCols[r] });
      solutions.push({ positions });
      return;
    }

    // Most-constrained unused region; any region with zero open cells is a dead end.
    let bestRegion = -1;
    let bestCount = Infinity;
    for (let region = 0; region < n; region++) {
      if ((regionMask >> region) & 1) continue;
      let count = 0;
      for (const cell of cellsByRegion[region]) if (isOpen(cell)) count++;
      if (count === 0) return;
      if (count < bestCount) {
        bestCount = count;
        bestRegion = region;
      }
    }

    for (const cell of cellsByRegion[bestRegion]) {
      if (!isOpen(cell)) continue;
      const r = (cell / n) | 0;
      const c = cell - r * n;
      rowMask |= 1 << r;
      colMask |= 1 << c;
      regionMask |= 1 << bestRegion;
      placedCols[r] = c;
      adjust(cell, 1);

      search(placed + 1);

      adjust(cell, -1);
      regionMask &= ~(1 << bestRegion);
      colMask &= ~(1 << c);
      rowMask &= ~(1 << r);
      if (solutions.length >= cap) return;
    }
  }

  search(0);
  return solutions;
}
