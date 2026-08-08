// Random-shuffle board generator with a headstart guarantee, not a
// full-solvability one.
//
// An earlier version of this generator guaranteed the WHOLE board was
// solvable, built via backward construction (deciding pairs in reverse play
// order against an initially-empty grid, then scattering as many as possible
// away from plain adjacent dominoes). No matter how that was tuned --
// batch size, retries, recursive splitting -- the scattered fraction capped
// out around 50-60%, because guaranteeing full solvability structurally
// forces a large minority of pairs into whatever adjacent slots are left
// once obstacle density climbs. See project memory / git history for the
// tuning trail.
//
// This version drops the full-solvability guarantee entirely: every value
// is placed via a genuine uniform-random shuffle, so a matching pair ending
// up adjacent is pure chance (roughly "number of adjacent cell-pairs on the
// board" out of "all possible cell-pairs" -- a small fraction for any
// reasonably sized board), not a side effect of a construction algorithm.
// The only thing generation still guarantees is a HEADSTART: simulating
// greedy play (engine.findLegalMove, repeatedly taking whatever legal move
// it finds) must succeed for at least `minHeadstartMoves` moves before the
// player could possibly get stuck, so a level never opens on a dead board.
// Past that headstart, the player might genuinely get stuck -- that's an
// accepted, already-handled outcome (Add Numbers, then Retry/Skip -- see
// GameScreen's FailOverlay), not a generation bug to design away.
//
// Note the very first move of ANY matching game is necessarily an adjacent
// pair: with the board completely full, nothing sits between any two cells
// except themselves, so no non-adjacent connection can exist yet. That's a
// physical property of the game, not this generator -- it's why the first
// move or two of the headstart will always look "obvious" no matter what
// generates the board, and it stops applying the instant the first pair
// clears and the board gains its first bit of empty space.
import { applyMatch, findLegalMove } from '../engine';
import type { GridValue } from '../types';
import type { RNG } from './rng';

export interface PairPlanEntry {
  kind: 'equal' | 'sum10';
}
export type PairPlan = PairPlanEntry[];

export interface BoardBuildParams {
  /** Generation reshuffles until simulated greedy play can make at least
   * this many moves in a row without getting stuck. */
  minHeadstartMoves: number;
  /** Reshuffle attempts before giving up and returning the last shuffle
   * regardless (never a hard failure -- see generateMatchingNumbersLevel). */
  maxAttempts: number;
}

export interface BuildBoardResult {
  grid: GridValue[][];
}

function makeEmptyGrid(rows: number, cols: number): GridValue[][] {
  return Array.from({ length: rows }, () => Array<GridValue>(cols).fill(null));
}

function shuffle<T>(rng: RNG, items: T[]): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickInRange(rng: RNG, range: [number, number]): number {
  return range[0] + Math.floor(rng() * (range[1] - range[0] + 1));
}

/** Nearest even value within range, rounded inward -- used whenever the other dimension is odd, since rows*cols must stay even for every cell to have a partner. */
function pickEvenInRange(rng: RNG, range: [number, number]): number {
  const evenFloor = range[0] % 2 === 0 ? range[0] : range[0] + 1;
  const evenCeil = range[1] % 2 === 0 ? range[1] : range[1] - 1;
  const span = Math.max(0, evenCeil - evenFloor) / 2;
  return evenFloor + 2 * Math.floor(rng() * (span + 1));
}

/** Cols are picked freely; rows are forced even only when cols lands odd (rows*cols must stay even). */
export function pickDims(rng: RNG, rowsRange: [number, number], colsRange: [number, number]): { rows: number; cols: number } {
  const cols = pickInRange(rng, colsRange);
  const rows = cols % 2 !== 0 ? pickEvenInRange(rng, rowsRange) : pickInRange(rng, rowsRange);
  return { rows, cols };
}

export function buildPairPlan(rng: RNG, m: number, equalWeight: number): PairPlan {
  return Array.from({ length: m }, () => ({ kind: rng() < equalWeight ? 'equal' : 'sum10' }));
}

function valuesFromPairPlan(rng: RNG, pairPlan: PairPlan): number[] {
  const values: number[] = [];
  for (const entry of pairPlan) {
    const d = 1 + Math.floor(rng() * 9);
    if (entry.kind === 'equal') values.push(d, d);
    else values.push(d, 10 - d);
  }
  return values;
}

function valuesToGrid(values: number[], rows: number, cols: number): GridValue[][] {
  const grid = makeEmptyGrid(rows, cols);
  values.forEach((v, i) => {
    grid[Math.floor(i / cols)][i % cols] = v;
  });
  return grid;
}

/** True if greedy play (always taking whatever legal move engine.findLegalMove finds, not necessarily the "best" one) survives `minMoves` steps without getting stuck. A cheap, honest proxy for "the player has room to get going" -- not a claim about optimal play. */
function hasHeadstart(grid: GridValue[][], minMoves: number): boolean {
  let current = grid;
  for (let i = 0; i < minMoves; i++) {
    const move = findLegalMove(current);
    if (!move) return false;
    current = applyMatch(current, move[0], move[1]);
  }
  return true;
}

export function buildBoard(rng: RNG, rows: number, cols: number, pairPlan: PairPlan, params: BoardBuildParams): BuildBoardResult {
  const m = (rows * cols) / 2;
  if (pairPlan.length !== m) {
    throw new Error(`pairPlan length ${pairPlan.length} does not match ${rows}x${cols} grid (expected ${m})`);
  }
  if ((rows * cols) % 2 !== 0) {
    throw new Error(`buildBoard requires an even total cell count (got ${rows}x${cols})`);
  }

  const values = valuesFromPairPlan(rng, pairPlan);
  const attempts = Math.max(1, params.maxAttempts);

  // Falls back to whatever the last attempt shuffled to if none hit the
  // headstart target -- never a hard failure, matching every other level of
  // this generator (see generateMatchingNumbersLevel's own retry loop).
  let grid = makeEmptyGrid(rows, cols);
  for (let attempt = 0; attempt < attempts; attempt++) {
    grid = valuesToGrid(shuffle(rng, values), rows, cols);
    if (hasHeadstart(grid, params.minHeadstartMoves)) break;
  }
  return { grid };
}
