// Pure game-logic functions for Tents & Trees. No React/RN dependencies in
// this file on purpose -- keeps it trivially unit-testable, same as every
// other game's engine.ts.
import type { Cell, TentsAndTreesLevel } from './types';

/** No tents placed yet -- the player adds them one at a time. */
export function makeInitialTents(rows: number, cols: number): boolean[][] {
  return Array.from({ length: rows }, () => Array<boolean>(cols).fill(false));
}

export function toggleTent(tents: boolean[][], r: number, c: number): boolean[][] {
  const next = tents.map((row) => row.slice());
  next[r][c] = !next[r][c];
  return next;
}

export interface TentsAndTreesCounts {
  rowCounts: number[];
  colCounts: number[];
}

/** Live tent counts -- recomputed from scratch every call, nothing cached. */
export function computeCounts(tents: boolean[][]): TentsAndTreesCounts {
  const rows = tents.length;
  const cols = tents[0]?.length ?? 0;
  const rowCounts = new Array(rows).fill(0);
  const colCounts = new Array(cols).fill(0);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (tents[r][c]) {
        rowCounts[r]++;
        colCounts[c]++;
      }
    }
  }

  return { rowCounts, colCounts };
}

/** Every truthy cell in a boolean grid, as `{r, c}` pairs. Shared with the solver. */
export function cellsFromGrid(grid: boolean[][]): Cell[] {
  const cells: Cell[] = [];
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c]) cells.push({ r, c });
    }
  }
  return cells;
}

/**
 * True if placing (or already having) a tent at (r, c) touches another
 * tent, including diagonally. Shared by the runtime win check, the
 * generator's incremental construction, and the solver's per-candidate
 * pruning, so the adjacency rule is defined in exactly one place.
 */
export function wouldTouchExistingTent(tentsGrid: boolean[][], r: number, c: number): boolean {
  const rows = tentsGrid.length;
  const cols = tentsGrid[0]?.length ?? 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && tentsGrid[nr][nc]) return true;
    }
  }
  return false;
}

/** True if any two placed tents touch, including diagonally. */
export function hasTouchingTents(tents: boolean[][]): boolean {
  for (let r = 0; r < tents.length; r++) {
    for (let c = 0; c < tents[r].length; c++) {
      if (tents[r][c] && wouldTouchExistingTent(tents, r, c)) return true;
    }
  }
  return false;
}

function isOrthogonallyAdjacent(a: Cell, b: Cell): boolean {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
}

/** True if any orthogonal neighbor of (r, c) is set in `grid`. Shared by the solver's candidate-cell filter and the generator's pair-placement rules. */
export function hasOrthogonalNeighbor(grid: boolean[][], r: number, c: number): boolean {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  return (
    (r > 0 && grid[r - 1][c]) ||
    (r < rows - 1 && grid[r + 1][c]) ||
    (c > 0 && grid[r][c - 1]) ||
    (c < cols - 1 && grid[r][c + 1])
  );
}

/**
 * Maximum bipartite matching between trees and tents by orthogonal
 * adjacency -- Kuhn's algorithm (DFS augmenting paths), trivial cost at
 * these grid sizes (rows*cols in the dozens, trees in the low tens).
 * `tentForTree[i]` is the tent index paired with `trees[i]` in the maximum
 * matching, or -1 if that tree didn't win a tent.
 */
function computeMaxMatching(trees: Cell[], tents: Cell[]): number[] {
  const adjacency: number[][] = trees.map((tree) =>
    tents.reduce<number[]>((acc, tent, j) => {
      if (isOrthogonallyAdjacent(tree, tent)) acc.push(j);
      return acc;
    }, [])
  );

  const treeForTent = new Array(tents.length).fill(-1);
  const tentForTree = new Array(trees.length).fill(-1);

  function tryAugment(treeIndex: number, visited: boolean[]): boolean {
    for (const tentIndex of adjacency[treeIndex]) {
      if (visited[tentIndex]) continue;
      visited[tentIndex] = true;
      if (treeForTent[tentIndex] === -1 || tryAugment(treeForTent[tentIndex], visited)) {
        treeForTent[tentIndex] = treeIndex;
        tentForTree[treeIndex] = tentIndex;
        return true;
      }
    }
    return false;
  }

  for (let i = 0; i < trees.length; i++) {
    tryAugment(i, new Array(tents.length).fill(false));
  }

  return tentForTree;
}

/**
 * True iff every tree can be paired with a distinct orthogonally-adjacent
 * tent (a perfect bipartite matching), not merely "some adjacent tent" --
 * two trees sharing their only possible tent is a genuine failure case this
 * must catch.
 */
export function hasPerfectMatching(trees: Cell[], tents: Cell[]): boolean {
  if (trees.length !== tents.length) return false;
  if (trees.length === 0) return true;
  return computeMaxMatching(trees, tents).every((tentIndex) => tentIndex !== -1);
}

/**
 * Trees that currently win a tent in the maximum matching -- the live
 * "matched" signal for the UI. Unlike simple adjacency, a single tent
 * bordering several trees can only ever match one of them, so this lights
 * up exactly one, not all of them, even on a partially-filled board.
 */
export function matchedTreeCells(trees: Cell[], tents: Cell[]): Set<string> {
  const tentForTree = computeMaxMatching(trees, tents);
  const matched = new Set<string>();
  trees.forEach((tree, i) => {
    if (tentForTree[i] !== -1) matched.add(`${tree.r},${tree.c}`);
  });
  return matched;
}

export function computeWin(level: TentsAndTreesLevel, tents: boolean[][]): boolean {
  const { rowCounts, colCounts } = computeCounts(tents);
  const countsMatch =
    rowCounts.every((count, r) => count === level.rowTargets[r]) && colCounts.every((count, c) => count === level.colTargets[c]);
  if (!countsMatch) return false;

  if (hasTouchingTents(tents)) return false;

  const treeCells = cellsFromGrid(level.trees);
  const tentCells = cellsFromGrid(tents);
  return hasPerfectMatching(treeCells, tentCells);
}

export interface HintResult {
  tents: boolean[][];
  r: number;
  c: number;
}

/**
 * Reveals one cell the player currently has wrong by snapping it to
 * `level.solutionTents` -- trusted directly because generation guarantees
 * that placement is the *only* one satisfying every constraint. Returns null
 * once every cell already matches (no hint left to give).
 */
export function applyHint(level: TentsAndTreesLevel, tents: boolean[][]): HintResult | null {
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) {
      if (tents[r][c] !== level.solutionTents[r][c]) {
        const next = tents.map((row) => row.slice());
        next[r][c] = level.solutionTents[r][c];
        return { tents: next, r, c };
      }
    }
  }
  return null;
}
