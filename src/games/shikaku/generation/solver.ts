import { containsCell } from '../engine';
import type { Clue, RectBounds, ShikakuLevel } from '../types';

export interface ShikakuSolution {
  /** rects[i] <-> level.clues[i]. */
  rects: RectBounds[];
}

type Board = Pick<ShikakuLevel, 'rows' | 'cols' | 'clues'>;

/** 2D prefix sum over a 0/1 grid marking clue cells, for O(1) "how many clues fall in this rectangle" queries. */
function buildCluePrefixSum(rows: number, cols: number, clues: Clue[]): number[][] {
  const grid = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (const clue of clues) grid[clue.r][clue.c] = 1;

  const prefix = Array.from({ length: rows + 1 }, () => new Array<number>(cols + 1).fill(0));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      prefix[r + 1][c + 1] = grid[r][c] + prefix[r][c + 1] + prefix[r + 1][c] - prefix[r][c];
    }
  }
  return prefix;
}

function clueCountInRect(prefix: number[][], rect: RectBounds): number {
  const { r0, c0, r1, c1 } = rect;
  return prefix[r1 + 1][c1 + 1] - prefix[r0][c1 + 1] - prefix[r1 + 1][c0] + prefix[r0][c0];
}

/**
 * Every factor-pair placement of `clue.value` that contains `clue`'s own
 * cell, stays in bounds, and contains no *other* clue cell -- checked via the
 * prefix sum in O(1) per candidate rather than an O(area) scan. Iterating
 * height 1..value naturally covers both orientations of every factor pair
 * (h, w) and (w, h) without producing duplicates.
 */
function candidatesForClue(clue: Clue, rows: number, cols: number, prefix: number[][]): RectBounds[] {
  const candidates: RectBounds[] = [];
  const { value } = clue;

  for (let h = 1; h <= value; h++) {
    if (value % h !== 0) continue;
    const w = value / h;
    if (h > rows || w > cols) continue;

    const r0min = Math.max(0, clue.r - h + 1);
    const r0max = Math.min(clue.r, rows - h);
    const c0min = Math.max(0, clue.c - w + 1);
    const c0max = Math.min(clue.c, cols - w);

    for (let r0 = r0min; r0 <= r0max; r0++) {
      for (let c0 = c0min; c0 <= c0max; c0++) {
        const rect: RectBounds = { r0, c0, r1: r0 + h - 1, c1: c0 + w - 1 };
        if (clueCountInRect(prefix, rect) === 1) candidates.push(rect);
      }
    }
  }

  return candidates;
}

/**
 * Backtracks by repeatedly scanning row-major for the first still-uncovered
 * cell and trying only the candidate rectangles (from each unused clue's
 * precomputed list) that cover that exact cell and don't overlap what's
 * already painted -- pinning the search to always extend the covered region
 * from a fixed frontier, same per-item precomputed-candidate-list +
 * immediate-prune shape as Cross Sums/Tents & Trees' solvers. Stops at `cap`
 * solutions found; used at generation time with `cap=2` purely to confirm
 * uniqueness (a second solution found means "reject", not "here it is").
 */
export function solveShikaku(level: Board, cap = 2): ShikakuSolution[] {
  const { rows, cols, clues } = level;
  const solutions: ShikakuSolution[] = [];

  if (rows === 0 || cols === 0) return clues.length === 0 ? [{ rects: [] }] : [];
  if (clues.length === 0) return [];

  const prefix = buildCluePrefixSum(rows, cols, clues);
  const candidatesByClue = clues.map((clue) => candidatesForClue(clue, rows, cols, prefix));
  if (candidatesByClue.some((candidates) => candidates.length === 0)) return solutions;

  const clueCount = clues.length;
  const owner = new Array<number>(rows * cols).fill(-1);
  const used = new Array<boolean>(clueCount).fill(false);
  const placedRects = new Array<RectBounds>(clueCount);

  const indexOf = (r: number, c: number): number => r * cols + c;

  function firstUncovered(): { r: number; c: number } | null {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (owner[indexOf(r, c)] === -1) return { r, c };
      }
    }
    return null;
  }

  function fits(rect: RectBounds): boolean {
    for (let r = rect.r0; r <= rect.r1; r++) {
      for (let c = rect.c0; c <= rect.c1; c++) {
        if (owner[indexOf(r, c)] !== -1) return false;
      }
    }
    return true;
  }

  function paint(rect: RectBounds, clueIndex: number): void {
    for (let r = rect.r0; r <= rect.r1; r++) {
      for (let c = rect.c0; c <= rect.c1; c++) {
        owner[indexOf(r, c)] = clueIndex;
      }
    }
  }

  function unpaint(rect: RectBounds): void {
    for (let r = rect.r0; r <= rect.r1; r++) {
      for (let c = rect.c0; c <= rect.c1; c++) {
        owner[indexOf(r, c)] = -1;
      }
    }
  }

  function backtrack(): void {
    if (solutions.length >= cap) return;

    const target = firstUncovered();
    if (!target) {
      solutions.push({ rects: placedRects.slice() });
      return;
    }
    const { r, c } = target;

    for (let i = 0; i < clueCount; i++) {
      if (used[i]) continue;

      for (const candidate of candidatesByClue[i]) {
        if (!containsCell(candidate, r, c) || !fits(candidate)) continue;

        paint(candidate, i);
        used[i] = true;
        placedRects[i] = candidate;

        backtrack();

        unpaint(candidate);
        used[i] = false;
        if (solutions.length >= cap) return;
      }
      if (solutions.length >= cap) return;
    }
  }

  backtrack();
  return solutions;
}
