import type { CrossSumsLevel } from '../types';

export interface CrossSumsSolution {
  mask: boolean[][];
}

type Board = Pick<CrossSumsLevel, 'rows' | 'cols' | 'grid' | 'rowTargets' | 'colTargets'>;

function subsetsSummingTo(row: number[], target: number): number[] {
  const cols = row.length;
  const masks: number[] = [];
  for (let mask = 0; mask < 1 << cols; mask++) {
    let sum = 0;
    for (let c = 0; c < cols; c++) {
      if (mask & (1 << c)) sum += row[c];
    }
    if (sum === target) masks.push(mask);
  }
  return masks;
}

function maskToRow(mask: number, cols: number): boolean[] {
  const row: boolean[] = new Array(cols).fill(false);
  for (let c = 0; c < cols; c++) row[c] = (mask & (1 << c)) !== 0;
  return row;
}

/**
 * Backtracks row by row. Per row, only tries the (precomputed) subsets of
 * that row's cells whose sum hits `rowTargets[r]` -- a row with zero such
 * subsets makes the whole board infeasible, so bails immediately. After
 * committing a row's subset, prunes on two column bounds: the running
 * column sum already exceeding its target (over-shoot), or the column's
 * remaining deficit exceeding the max any suffix of not-yet-placed rows
 * could still contribute (under-shoot, standard subset-sum bounding). Same
 * cap-at-`cap` contract as `solveKings`/`solveBlockFill`.
 */
export function solveCrossSums(level: Board, cap = 2): CrossSumsSolution[] {
  const { rows, cols, grid, rowTargets, colTargets } = level;
  const solutions: CrossSumsSolution[] = [];

  const rowSubsets: number[][] = grid.map((row, r) => subsetsSummingTo(row, rowTargets[r]));
  if (rowSubsets.some((masks) => masks.length === 0)) return solutions;

  const maxSuffix: number[][] = Array.from({ length: rows + 1 }, () => new Array(cols).fill(0));
  for (let r = rows - 1; r >= 0; r--) {
    for (let c = 0; c < cols; c++) {
      maxSuffix[r][c] = maxSuffix[r + 1][c] + grid[r][c];
    }
  }

  const colRunning = new Array(cols).fill(0);
  const chosenMasks: number[] = [];

  function backtrack(r: number): void {
    if (solutions.length >= cap) return;
    if (r === rows) {
      solutions.push({ mask: chosenMasks.map((mask) => maskToRow(mask, cols)) });
      return;
    }

    for (const mask of rowSubsets[r]) {
      for (let c = 0; c < cols; c++) {
        if (mask & (1 << c)) colRunning[c] += grid[r][c];
      }

      let ok = true;
      for (let c = 0; c < cols; c++) {
        const remaining = colTargets[c] - colRunning[c];
        if (remaining < 0 || remaining > maxSuffix[r + 1][c]) {
          ok = false;
          break;
        }
      }

      if (ok) {
        chosenMasks.push(mask);
        backtrack(r + 1);
        chosenMasks.pop();
      }

      for (let c = 0; c < cols; c++) {
        if (mask & (1 << c)) colRunning[c] -= grid[r][c];
      }

      if (solutions.length >= cap) return;
    }
  }

  backtrack(0);
  return solutions;
}
