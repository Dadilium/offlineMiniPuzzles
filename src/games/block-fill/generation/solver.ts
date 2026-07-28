import type { BlockFillLevel, Cell } from '../types';

export interface BlockFillSolution {
  path: Cell[];
}

const DIRS: Array<[number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

type Board = Pick<BlockFillLevel, 'rows' | 'cols' | 'fillable' | 'start'>;

export function countFillable(fillable: boolean[][]): number {
  let n = 0;
  for (const row of fillable) for (const v of row) if (v) n++;
  return n;
}

/**
 * Backtracking Hamiltonian-path counter: DFS from the tip of `startingPath`
 * (defaults to just `level.start`) over unvisited orthogonal fillable
 * neighbors, stopping once `cap` complete paths are found. At every node,
 * prunes any branch where the not-yet-visited fillable cells aren't ALL
 * still reachable from here (a flood-fill check) -- a stranded cell can
 * never be covered later, so there's no point continuing down that branch.
 *
 * Same role as Kings' `solveKings` when called with the default start: the
 * generator only ships a level when this returns exactly one solution.
 * Runtime reuses the exact same search seeded with the player's live path
 * (see engine.ts) to find a completion or detect a dead end -- never trusts
 * `level.solutionPath` once the player has diverged from it, same reasoning
 * as Matching Numbers' `findLegalMove`.
 */
export function solveBlockFill(level: Board, cap = 2, startingPath?: Cell[]): BlockFillSolution[] {
  const { rows, cols, fillable, start } = level;
  const total = countFillable(fillable);
  const visited: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
  const solutions: BlockFillSolution[] = [];
  const initial = startingPath && startingPath.length > 0 ? startingPath : [start];
  const path: Cell[] = initial.slice();

  function isOpen(r: number, c: number): boolean {
    return r >= 0 && r < rows && c >= 0 && c < cols && fillable[r][c] && !visited[r][c];
  }

  function unvisitedFillableReachableFrom(cell: Cell): number {
    const seen = new Set<string>();
    const stack: Cell[] = [];
    for (const [dr, dc] of DIRS) {
      const rr = cell.r + dr;
      const cc = cell.c + dc;
      if (isOpen(rr, cc)) {
        const key = `${rr},${cc}`;
        if (!seen.has(key)) {
          seen.add(key);
          stack.push({ r: rr, c: cc });
        }
      }
    }
    while (stack.length > 0) {
      const cur = stack.pop()!;
      for (const [dr, dc] of DIRS) {
        const rr = cur.r + dr;
        const cc = cur.c + dc;
        if (!isOpen(rr, cc)) continue;
        const key = `${rr},${cc}`;
        if (seen.has(key)) continue;
        seen.add(key);
        stack.push({ r: rr, c: cc });
      }
    }
    return seen.size;
  }

  function backtrack(cell: Cell, filledCount: number): void {
    if (solutions.length >= cap) return;
    if (filledCount === total) {
      solutions.push({ path: path.slice() });
      return;
    }

    const remaining = total - filledCount;
    if (unvisitedFillableReachableFrom(cell) !== remaining) return;

    for (const [dr, dc] of DIRS) {
      if (solutions.length >= cap) return;
      const rr = cell.r + dr;
      const cc = cell.c + dc;
      if (!isOpen(rr, cc)) continue;

      visited[rr][cc] = true;
      path.push({ r: rr, c: cc });
      backtrack({ r: rr, c: cc }, filledCount + 1);
      path.pop();
      visited[rr][cc] = false;
    }
  }

  for (const cell of initial) visited[cell.r][cell.c] = true;
  backtrack(initial[initial.length - 1], initial.length);
  return solutions;
}
