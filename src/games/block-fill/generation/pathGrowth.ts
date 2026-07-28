import type { Cell } from '../types';
import type { RNG } from './rng';

const DIRS: Array<[number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

function shuffle<T>(rng: RNG, items: T[]): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Randomized growing self-avoiding walk (recursive-backtracker style): from
 * a random start cell, repeatedly extend into a random unvisited orthogonal
 * neighbor; when the tip has no unvisited neighbor left, pop it back off
 * (freeing the cell for a different branch) and resume from the new tip with
 * its next untried candidate. Every cell that's still part of `path` when
 * the walk ends is -- by construction -- reachable from `start` in that
 * exact order, so the walk itself is a witness solution (no separate solver
 * pass needed to know *a* Hamiltonian path exists over the visited set; the
 * generator still runs a real solver afterward to confirm it's the *only*
 * one). Returns null if the achieved length falls short of `minFillRatio` --
 * caller just retries with a fresh seed, same contract as Kings'
 * `generateRegions`.
 */
export function growPath(rows: number, cols: number, rng: RNG, minFillRatio: number, backtrackBudget: number): Cell[] | null {
  const total = rows * cols;
  const targetLength = Math.max(2, Math.round(total * minFillRatio));

  const visited: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
  const start: Cell = { r: Math.floor(rng() * rows), c: Math.floor(rng() * cols) };
  const path: Cell[] = [start];
  visited[start.r][start.c] = true;

  function unvisitedNeighbors(cell: Cell): Cell[] {
    const out: Cell[] = [];
    for (const [dr, dc] of DIRS) {
      const rr = cell.r + dr;
      const cc = cell.c + dc;
      if (rr >= 0 && rr < rows && cc >= 0 && cc < cols && !visited[rr][cc]) out.push({ r: rr, c: cc });
    }
    return out;
  }

  const candidateStacks: Cell[][] = [shuffle(rng, unvisitedNeighbors(start))];
  let backtracksLeft = backtrackBudget;

  while (path.length < targetLength) {
    const top = candidateStacks[candidateStacks.length - 1];
    if (top.length === 0) {
      candidateStacks.pop();
      if (candidateStacks.length === 0) break; // exhausted every branch back to the start -- as long as this walk gets

      const popped = path.pop()!;
      visited[popped.r][popped.c] = false;

      if (backtracksLeft <= 0) break;
      backtracksLeft--;
      continue;
    }

    const next = top.pop()!;
    visited[next.r][next.c] = true;
    path.push(next);
    candidateStacks.push(shuffle(rng, unvisitedNeighbors(next)));
  }

  if (path.length < targetLength) return null;
  return path;
}
