import { cellsFromGrid, hasOrthogonalNeighbor, hasPerfectMatching, wouldTouchExistingTent } from '../engine';
import type { Cell, TentsAndTreesLevel } from '../types';

export interface TentsAndTreesSolution {
  tents: boolean[][];
}

type Board = Pick<TentsAndTreesLevel, 'rows' | 'cols' | 'trees' | 'rowTargets' | 'colTargets'>;

/**
 * Backtracks over candidate cells (empty cells adjacent to at least one
 * tree -- any other empty cell can never hold a tent in a valid solution, so
 * it's pruned out of the search entirely, same spirit as Cross Sums'
 * per-row subset precompute). At each candidate, prunes on: 8-adjacency
 * conflict with an already-placed tent, and row/col running counts that
 * have overshot their target or can no longer reach it given how many
 * candidates remain in that row/col (suffix-count bound, the count-based
 * analogue of Cross Sums' column sum bound). A full assignment only counts
 * as a solution once it also passes the tree-tent perfect-matching check --
 * matching counts as a tent placement, not a search branch, since it's a
 * global property of the finished board, not something to prune on
 * per-cell. Same cap-at-`cap` uniqueness-only contract as `solveCrossSums`.
 */
export function solveTentsAndTrees(level: Board, cap = 2): TentsAndTreesSolution[] {
  const { rows, cols, trees, rowTargets, colTargets } = level;
  const solutions: TentsAndTreesSolution[] = [];

  const candidates: Cell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!trees[r][c] && hasOrthogonalNeighbor(trees, r, c)) candidates.push({ r, c });
    }
  }

  const treeCells = cellsFromGrid(trees);
  const treeCount = treeCells.length;
  const n = candidates.length;

  const suffixRowCount: number[][] = Array.from({ length: n + 1 }, () => new Array(rows).fill(0));
  const suffixColCount: number[][] = Array.from({ length: n + 1 }, () => new Array(cols).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    suffixRowCount[i] = suffixRowCount[i + 1].slice();
    suffixColCount[i] = suffixColCount[i + 1].slice();
    suffixRowCount[i][candidates[i].r]++;
    suffixColCount[i][candidates[i].c]++;
  }

  function feasible(i: number): boolean {
    for (let r = 0; r < rows; r++) {
      const remaining = rowTargets[r] - rowRunning[r];
      if (remaining < 0 || remaining > suffixRowCount[i][r]) return false;
    }
    for (let c = 0; c < cols; c++) {
      const remaining = colTargets[c] - colRunning[c];
      if (remaining < 0 || remaining > suffixColCount[i][c]) return false;
    }
    return true;
  }

  const rowRunning = new Array(rows).fill(0);
  const colRunning = new Array(cols).fill(0);
  const tentsGrid: boolean[][] = Array.from({ length: rows }, () => new Array(cols).fill(false));
  let tentsPlaced = 0;

  function backtrack(i: number): void {
    if (solutions.length >= cap) return;

    if (i === n) {
      if (tentsPlaced !== treeCount) return;
      const tentCells = cellsFromGrid(tentsGrid);
      if (!hasPerfectMatching(treeCells, tentCells)) return;
      solutions.push({ tents: tentsGrid.map((row) => row.slice()) });
      return;
    }

    const { r, c } = candidates[i];

    if (rowRunning[r] < rowTargets[r] && colRunning[c] < colTargets[c] && !wouldTouchExistingTent(tentsGrid, r, c)) {
      tentsGrid[r][c] = true;
      rowRunning[r]++;
      colRunning[c]++;
      tentsPlaced++;
      if (feasible(i + 1)) backtrack(i + 1);
      tentsGrid[r][c] = false;
      rowRunning[r]--;
      colRunning[c]--;
      tentsPlaced--;
      if (solutions.length >= cap) return;
    }

    if (feasible(i + 1)) backtrack(i + 1);
  }

  if (n >= treeCount && feasible(0)) backtrack(0);
  return solutions;
}
