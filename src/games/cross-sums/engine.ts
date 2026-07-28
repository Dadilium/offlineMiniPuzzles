// Pure game-logic functions for Cross Sums. No React/RN dependencies in this
// file on purpose -- keeps it trivially unit-testable, same as every other
// game's engine.ts.
import type { CrossSumsLevel } from './types';

/** Every cell starts kept -- the player crosses out the ones that don't belong. */
export function makeInitialMask(rows: number, cols: number): boolean[][] {
  return Array.from({ length: rows }, () => Array<boolean>(cols).fill(true));
}

export function toggleCell(mask: boolean[][], r: number, c: number): boolean[][] {
  const next = mask.map((row) => row.slice());
  next[r][c] = !next[r][c];
  return next;
}

export interface CrossSumsSums {
  rowSums: number[];
  colSums: number[];
}

/** Live sums of the currently-kept cells -- recomputed from scratch every call, nothing cached. */
export function computeSums(grid: number[][], mask: boolean[][]): CrossSumsSums {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const rowSums = new Array(rows).fill(0);
  const colSums = new Array(cols).fill(0);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (mask[r][c]) {
        rowSums[r] += grid[r][c];
        colSums[c] += grid[r][c];
      }
    }
  }

  return { rowSums, colSums };
}

export function computeWin(level: CrossSumsLevel, mask: boolean[][]): boolean {
  const { rowSums, colSums } = computeSums(level.grid, mask);
  return rowSums.every((sum, r) => sum === level.rowTargets[r]) && colSums.every((sum, c) => sum === level.colTargets[c]);
}

export interface HintResult {
  mask: boolean[][];
  r: number;
  c: number;
}

/**
 * Reveals one cell the player currently has wrong by snapping it to
 * `level.solutionMask` -- trusted directly (unlike Block Fill/Matching
 * Numbers' live-recompute hints) because generation guarantees that mask is
 * the *only* one satisfying every row and column target. Returns null once
 * every cell already matches (no hint left to give).
 */
export function applyHint(level: CrossSumsLevel, mask: boolean[][]): HintResult | null {
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) {
      if (mask[r][c] !== level.solutionMask[r][c]) {
        const next = mask.map((row) => row.slice());
        next[r][c] = level.solutionMask[r][c];
        return { mask: next, r, c };
      }
    }
  }
  return null;
}
