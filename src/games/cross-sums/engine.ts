// Pure game-logic functions for Cross Sums. No React/RN dependencies in this
// file on purpose -- keeps it trivially unit-testable, same as every other
// game's engine.ts.
import type { CrossSumsLevel } from './types';

/** A cell starts neutral, then the pen circles it into the sum ('selected')
 * or the eraser crosses it out ('erased') -- both start out excluded, the
 * difference is purely the player's own bookkeeping. */
export type CellMark = 'neutral' | 'selected' | 'erased';
export type Tool = 'pen' | 'eraser';

export function makeInitialMarks(rows: number, cols: number): CellMark[][] {
  return Array.from({ length: rows }, () => Array<CellMark>(cols).fill('neutral'));
}

/** Applies the active tool's mark to one cell -- tapping a cell that already
 * carries that tool's mark clears it back to neutral, so pen/eraser both
 * double as their own undo. */
export function applyTool(marks: CellMark[][], r: number, c: number, tool: Tool): CellMark[][] {
  const target: CellMark = tool === 'pen' ? 'selected' : 'erased';
  const next = marks.map((row) => row.slice());
  next[r][c] = next[r][c] === target ? 'neutral' : target;
  return next;
}

export interface CrossSumsSums {
  rowSums: number[];
  colSums: number[];
}

/** Live sums of the currently-circled ('selected') cells -- recomputed from scratch every call, nothing cached. */
export function computeSums(grid: number[][], marks: CellMark[][]): CrossSumsSums {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const rowSums = new Array(rows).fill(0);
  const colSums = new Array(cols).fill(0);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (marks[r][c] === 'selected') {
        rowSums[r] += grid[r][c];
        colSums[c] += grid[r][c];
      }
    }
  }

  return { rowSums, colSums };
}

export function computeWin(level: CrossSumsLevel, marks: CellMark[][]): boolean {
  const { rowSums, colSums } = computeSums(level.grid, marks);
  return rowSums.every((sum, r) => sum === level.rowTargets[r]) && colSums.every((sum, c) => sum === level.colTargets[c]);
}

export interface HintResult {
  marks: CellMark[][];
  r: number;
  c: number;
}

/**
 * Reveals one cell the player currently has wrong by snapping it to
 * `level.solutionMask` -- trusted directly (unlike Block Fill/Matching
 * Numbers' live-recompute hints) because generation guarantees that mask is
 * the *only* one satisfying every row and column target. A cell only counts
 * as wrong if its "selected or not" state disagrees with the solution --
 * neutral and erased are equivalent there, both excluded from the sum.
 * Returns null once every cell already matches (no hint left to give).
 */
export function applyHint(level: CrossSumsLevel, marks: CellMark[][]): HintResult | null {
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) {
      const shouldSelect = level.solutionMask[r][c];
      const isSelected = marks[r][c] === 'selected';
      if (isSelected !== shouldSelect) {
        const next = marks.map((row) => row.slice());
        next[r][c] = shouldSelect ? 'selected' : 'erased';
        return { marks: next, r, c };
      }
    }
  }
  return null;
}
