import type { KingsLevel } from '../types';

export interface KingsSolution {
  positions: Array<{ r: number; c: number }>;
}

/**
 * Enumerates valid king placements (one per row/column/region, no two
 * touching -- including diagonally), stopping once `cap` solutions are
 * found. Places one king per row by construction, so row/adjacency-within-a-
 * row conflicts can't occur; only needs to check column/region uniqueness
 * and adjacency against kings already placed in earlier rows. Same rules as
 * `computeKingsState` in the app's kings/engine.ts.
 */
export function solveKings(level: KingsLevel, cap = 2): KingsSolution[] {
  const n = level.n;
  const solutions: KingsSolution[] = [];
  const usedCols = new Set<number>();
  const usedRegions = new Set<number>();
  const placed: Array<{ r: number; c: number }> = [];

  function touchesPlaced(r: number, c: number): boolean {
    return placed.some((p) => Math.abs(p.r - r) <= 1 && Math.abs(p.c - c) <= 1);
  }

  function backtrack(row: number): void {
    if (solutions.length >= cap) return;
    if (row === n) {
      solutions.push({ positions: placed.slice() });
      return;
    }
    for (let c = 0; c < n; c++) {
      if (usedCols.has(c)) continue;
      const region = level.regions[row][c];
      if (usedRegions.has(region)) continue;
      if (touchesPlaced(row, c)) continue;

      usedCols.add(c);
      usedRegions.add(region);
      placed.push({ r: row, c });

      backtrack(row + 1);

      placed.pop();
      usedRegions.delete(region);
      usedCols.delete(c);

      if (solutions.length >= cap) return;
    }
  }

  backtrack(0);
  return solutions;
}
