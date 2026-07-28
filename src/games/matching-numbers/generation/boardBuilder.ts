// The guaranteed-solvable board generator.
//
// Key insight: a connectable path only ever depends on cells being EMPTY
// (never on a cell being filled with some specific value), and cells only
// ever go from filled -> empty during play, never the reverse (Add Numbers
// appends new rows, it never re-fills an already-cleared cell). So
// connectivity is monotonic -- once a path is clear, it stays clear forever.
// Two consequences fall out of that:
//
//  1. Two grid-ADJACENT cells (sharing an edge) are ALWAYS connectable, no
//     matter what else is on the board -- there's nothing between them to
//     block. A board tiled entirely with adjacent dominoes is therefore
//     trivially, unconditionally solvable in any order at all.
//
//  2. If a small pool of cells is played only AFTER every other (adjacent,
//     always-safe) domino has already been cleared, that pool effectively
//     has the WHOLE REST OF THE BOARD as empty background for the entire
//     time it's being played -- so building a guaranteed-legal order for
//     just that pool (via the same backward-construction idea, applied to
//     a small subset of cells instead of the whole board) is a much smaller,
//     fast problem, regardless of how big the overall board is.
//
// So the generator: (1) tiles the whole board with adjacent horizontal
// dominoes (guaranteed valid, cols is kept even for exactly this reason),
// (2) reserves a small "complex pool" of cells (a handful of whole dominoes,
// pulled out of the plain tiling) sized independently of the board, and (3)
// re-derives that pool's pairing via backward construction against a grid
// where every non-pool cell is permanently empty -- producing genuinely
// spread-out (non-adjacent) pairs. The final play order is simply: every
// plain domino first (any order, they don't care), then the pool's pairs in
// their constructed order.
import { canConnect } from '../engine';
import type { Cell, GridValue } from '../types';
import type { RNG } from './rng';

export interface PairPlanEntry {
  kind: 'equal' | 'sum10';
}
export type PairPlan = PairPlanEntry[];

export interface BoardBuildParams {
  /** How many pairs to try to make non-adjacent (spread across the board),
   * independent of board size -- kept small so the pool's own backward
   * construction stays fast no matter how big the overall board gets. */
  complexPairTarget: number;
  /** 0..1 -- among the pool's non-adjacent candidates, probability of
   * preferring a single-bend one over a same-row/col-with-a-gap one. */
  bendBias: number;
  /** Caps how many candidate pairs are collected at each pool construction
   * step before choosing among them. */
  candidatePoolCap: number;
  /** Total candidate placements the pool's backward-construction search may
   * try before giving up on making a cell pair non-adjacent (falls back to
   * leaving those cells as a plain adjacent domino -- never a hard failure). */
  backtrackBudget: number;
}

export interface BuildBoardResult {
  grid: GridValue[][];
  solutionOrder: Array<[Cell, Cell]>;
}

function makeEmptyGrid(rows: number, cols: number): GridValue[][] {
  return Array.from({ length: rows }, () => Array<GridValue>(cols).fill(null));
}

function sameCell(a: Cell, b: Cell): boolean {
  return a.r === b.r && a.c === b.c;
}

function isAdjacent(a: Cell, b: Cell): boolean {
  return (a.r === b.r && Math.abs(a.c - b.c) === 1) || (a.c === b.c && Math.abs(a.r - b.r) === 1);
}

function shuffle<T>(rng: RNG, items: T[]): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Picks rows freely and cols even (within range) -- an even column count is what makes the base horizontal-domino tiling always exist. */
export function pickDims(rng: RNG, rowsRange: [number, number], colsRange: [number, number]): { rows: number; cols: number } {
  const rows = rowsRange[0] + Math.floor(rng() * (rowsRange[1] - rowsRange[0] + 1));
  const evenFloor = colsRange[0] % 2 === 0 ? colsRange[0] : colsRange[0] + 1;
  const evenCeil = colsRange[1] % 2 === 0 ? colsRange[1] : colsRange[1] - 1;
  const span = Math.max(0, evenCeil - evenFloor) / 2;
  const cols = evenFloor + 2 * Math.floor(rng() * (span + 1));
  return { rows, cols };
}

export function buildPairPlan(rng: RNG, m: number, equalWeight: number): PairPlan {
  return Array.from({ length: m }, () => ({ kind: rng() < equalWeight ? 'equal' : 'sum10' }));
}

/**
 * Scans a fully-shuffled list of all cell pairs within `uncommitted` (not a
 * nested loop over shuffled cells, which would anchor the collected
 * candidates on whichever cell happens to land first). Classifies into
 * adjacent / same-row-or-col / bent; `preferNonAdjacentRate` weights how
 * often a non-adjacent candidate is tried before falling back to an
 * adjacent one, and `bendBias` weights bent vs. same-row/col-with-a-gap
 * within the non-adjacent set.
 */
function collectConnectablePairs(
  rng: RNG,
  grid: GridValue[][],
  uncommitted: Cell[],
  preferNonAdjacentRate: number,
  bendBias: number,
  candidatePoolCap: number
): Array<[Cell, Cell]> {
  const allPairs: Array<[Cell, Cell]> = [];
  for (let i = 0; i < uncommitted.length; i++) {
    for (let j = i + 1; j < uncommitted.length; j++) {
      allPairs.push([uncommitted[i], uncommitted[j]]);
    }
  }
  const shuffledPairs = shuffle(rng, allPairs);

  const adjacent: Array<[Cell, Cell]> = [];
  const straightFar: Array<[Cell, Cell]> = [];
  const bent: Array<[Cell, Cell]> = [];
  for (const [a, b] of shuffledPairs) {
    const conn = canConnect(grid, a, b);
    if (!conn.ok) continue;
    if (!conn.bend && isAdjacent(a, b)) adjacent.push([a, b]);
    else (conn.bend ? bent : straightFar).push([a, b]);
    if (adjacent.length + straightFar.length + bent.length >= candidatePoolCap) break;
  }

  const nonAdjacent = rng() < bendBias ? [...bent, ...straightFar] : [...straightFar, ...bent];
  return rng() < preferNonAdjacentRate ? [...nonAdjacent, ...adjacent] : [...adjacent, ...nonAdjacent];
}

interface Budget {
  remaining: number;
}

/**
 * DFS backtracking over the pool's pair-placement tree: try candidates
 * (non-adjacent strongly preferred) and recurse; if a candidate's subtree
 * can't complete the remaining pairs, undo it and try the next one. Bounded
 * by a global `budget` -- returns false on exhaustion, at which point the
 * caller just leaves those cells as their original plain adjacent dominoes.
 */
function backtrackPool(
  rng: RNG,
  grid: GridValue[][],
  uncommitted: Cell[],
  k: number,
  order: Array<[Cell, Cell]>,
  bendBias: number,
  candidatePoolCap: number,
  budget: Budget
): boolean {
  if (k === 0) return true;

  const candidates = collectConnectablePairs(rng, grid, uncommitted, 0.92, bendBias, candidatePoolCap);
  for (const [a, b] of candidates) {
    if (budget.remaining <= 0) return false;
    budget.remaining--;

    grid[a.r][a.c] = 1; // placeholder marker -- real digit values are assigned after the whole order is known
    grid[b.r][b.c] = 1;
    order[k - 1] = [a, b];
    const nextUncommitted = uncommitted.filter((cell) => !sameCell(cell, a) && !sameCell(cell, b));

    if (backtrackPool(rng, grid, nextUncommitted, k - 1, order, bendBias, candidatePoolCap, budget)) return true;

    grid[a.r][a.c] = null;
    grid[b.r][b.c] = null;
  }
  return false;
}

export function buildBoard(rng: RNG, rows: number, cols: number, pairPlan: PairPlan, params: BoardBuildParams): BuildBoardResult {
  const m = (rows * cols) / 2;
  if (pairPlan.length !== m) {
    throw new Error(`pairPlan length ${pairPlan.length} does not match ${rows}x${cols} grid (expected ${m})`);
  }
  if (cols % 2 !== 0) {
    throw new Error(`buildBoard requires an even column count (got ${cols})`);
  }

  // Base tiling: every row split into adjacent horizontal dominoes.
  const dominoes: Array<[Cell, Cell]> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c += 2) {
      dominoes.push([{ r, c }, { r, c: c + 1 }]);
    }
  }

  const poolSize = Math.max(0, Math.min(params.complexPairTarget, m));
  const shuffledDominoIdx = shuffle(
    rng,
    dominoes.map((_, i) => i)
  );
  const poolIdxSet = new Set(shuffledDominoIdx.slice(0, poolSize));

  const plainDominoes = dominoes.filter((_, i) => !poolIdxSet.has(i));
  const poolCells = shuffledDominoIdx.slice(0, poolSize).flatMap((i) => dominoes[i]);

  // Pool's own backward construction: every non-pool cell is permanently
  // empty background (those dominoes are all played -- and so cleared --
  // before the pool phase begins), so only pool cells count as "occupied"
  // in this grid.
  const poolGrid = makeEmptyGrid(rows, cols);
  const poolOrder = new Array<[Cell, Cell]>(poolSize);
  const budget: Budget = { remaining: params.backtrackBudget };
  const poolBuilt = backtrackPool(rng, poolGrid, poolCells, poolSize, poolOrder, params.bendBias, params.candidatePoolCap, budget);

  // poolBuilt is expected to succeed given the generous background freedom,
  // but if it doesn't (or only partially filled poolOrder), the untouched
  // cells simply keep their original plain-domino pairing -- always safe,
  // never a hard failure.
  const finalPoolOrder = poolBuilt ? poolOrder : [];
  const unusedPoolDominoes = poolSize > 0 && !poolBuilt ? shuffledDominoIdx.slice(0, poolSize).map((i) => dominoes[i]) : [];

  const solutionOrder: Array<[Cell, Cell]> = [...shuffle(rng, [...plainDominoes, ...unusedPoolDominoes]), ...finalPoolOrder];

  const grid = makeEmptyGrid(rows, cols);
  solutionOrder.forEach(([a, b], i) => {
    const entry = pairPlan[i];
    const d = 1 + Math.floor(rng() * 9);
    const [va, vb] = entry.kind === 'equal' ? [d, d] : [d, 10 - d];
    grid[a.r][a.c] = va;
    grid[b.r][b.c] = vb;
  });

  return { grid, solutionOrder };
}
