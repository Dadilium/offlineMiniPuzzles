import { hasOrthogonalNeighbor, wouldTouchExistingTent } from '../engine';
import type { Cell, TentsAndTreesLevel } from '../types';
import type { GenerationParams } from './difficulty';
import { fingerprintTentsAndTrees } from './fingerprint';
import type { RNG } from './rng';
import { solveTentsAndTrees } from './solver';

export interface GenerateSuccess {
  level: TentsAndTreesLevel;
  attempts: number;
  fingerprint: string;
}

export interface GenerateFailure {
  attempts: number;
}

/** Cap on tree/tent pair placements tried within a single board attempt, before giving up on that size/density and moving to the next attempt. */
const MAX_PAIR_ATTEMPTS_MULTIPLIER = 40;

function randInt(rng: RNG, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function shuffled<T>(rng: RNG, items: T[]): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function orthogonalNeighbors(r: number, c: number, rows: number, cols: number): Cell[] {
  const neighbors: Cell[] = [];
  if (r > 0) neighbors.push({ r: r - 1, c });
  if (r < rows - 1) neighbors.push({ r: r + 1, c });
  if (c > 0) neighbors.push({ r, c: c - 1 });
  if (c < cols - 1) neighbors.push({ r, c: c + 1 });
  return neighbors;
}

/**
 * Constructs a solved board directly (tree + its paired tent placed
 * together each step) rather than dealing trees at random and hoping a
 * valid tent assignment exists -- valid tree/tent pairs are a small
 * fraction of all placements once the no-touch rule is in play, so
 * random-deal-then-solve would waste almost every attempt on infeasible
 * boards. Returns null if it can't reach the requested tree count within
 * the pair-attempt budget (e.g. the grid filled up too much to fit more).
 *
 * Beyond the game's actual rules (no touching tents, one tent per tree
 * overall), each new pair is also rejected if it would leave a tree or tent
 * incidentally bordering someone else's partner -- e.g. a new tree placed
 * next to an already-placed tent, or a new tent placed next to an
 * already-placed tree. That's not a rule violation (the real win condition
 * only needs *some* valid matching to exist), but a tree visibly touching
 * two tents reads as "this looks unsolved/wrong" to a player even on a
 * solved board, since there's no way to tell which neighbor is its actual
 * match. Keeping every tree's single physical neighbor its only physical
 * neighbor keeps solved boards visually unambiguous.
 */
function constructSolvedBoard(
  rng: RNG,
  rows: number,
  cols: number,
  targetTreeCount: number
): { trees: boolean[][]; tents: boolean[][] } | null {
  const trees: boolean[][] = Array.from({ length: rows }, () => new Array(cols).fill(false));
  const tents: boolean[][] = Array.from({ length: rows }, () => new Array(cols).fill(false));
  const used: boolean[][] = Array.from({ length: rows }, () => new Array(cols).fill(false));

  let treesPlaced = 0;
  const maxPairAttempts = targetTreeCount * MAX_PAIR_ATTEMPTS_MULTIPLIER;

  for (let pairAttempt = 0; pairAttempt < maxPairAttempts && treesPlaced < targetTreeCount; pairAttempt++) {
    const tr = randInt(rng, 0, rows - 1);
    const tc = randInt(rng, 0, cols - 1);
    if (used[tr][tc] || hasOrthogonalNeighbor(tents, tr, tc)) continue;

    const tentCandidates = shuffled(rng, orthogonalNeighbors(tr, tc, rows, cols)).filter(
      ({ r, c }) => !used[r][c] && !wouldTouchExistingTent(tents, r, c) && !hasOrthogonalNeighbor(trees, r, c)
    );
    if (tentCandidates.length === 0) continue;

    const tent = tentCandidates[0];
    trees[tr][tc] = true;
    tents[tent.r][tent.c] = true;
    used[tr][tc] = true;
    used[tent.r][tent.c] = true;
    treesPlaced++;
  }

  return treesPlaced === targetTreeCount ? { trees, tents } : null;
}

function targetsFromTents(tents: boolean[][], rows: number, cols: number): { rowTargets: number[]; colTargets: number[] } {
  const rowTargets = new Array(rows).fill(0);
  const colTargets = new Array(cols).fill(0);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (tents[r][c]) {
        rowTargets[r]++;
        colTargets[c]++;
      }
    }
  }
  return { rowTargets, colTargets };
}

/**
 * Pure, seeded rejection-sampling search: construct a solved board, derive
 * its row/col clues, then keep the first attempt where (a) it isn't a
 * near-duplicate of a recently served board and (b) `solveTentsAndTrees`
 * confirms the clues force exactly that tent placement and no other. Same
 * shape as `generateCrossSumsLevel` -- never ships an ambiguous board, fails
 * outright rather than quietly serving one within `maxAttempts`.
 */
export function generateTentsAndTreesLevel(
  rng: RNG,
  params: GenerationParams,
  recentFingerprints: string[] = [],
  maxAttempts = 6000
): GenerateSuccess | GenerateFailure {
  const recent = new Set(recentFingerprints);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const rows = randInt(rng, params.rowsRange[0], params.rowsRange[1]);
    const cols = randInt(rng, params.colsRange[0], params.colsRange[1]);
    const density = params.treeDensity[0] + rng() * (params.treeDensity[1] - params.treeDensity[0]);
    const targetTreeCount = Math.max(1, Math.round(rows * cols * density));

    const constructed = constructSolvedBoard(rng, rows, cols, targetTreeCount);
    if (!constructed) continue;
    const { trees, tents } = constructed;

    const { rowTargets, colTargets } = targetsFromTents(tents, rows, cols);
    const fingerprint = fingerprintTentsAndTrees(trees, rowTargets, colTargets);
    if (recent.has(fingerprint)) continue;

    const level: TentsAndTreesLevel = { rows, cols, trees, rowTargets, colTargets, solutionTents: tents };
    const solutions = solveTentsAndTrees(level, 2);
    if (solutions.length !== 1) continue;

    return { level, attempts: attempt, fingerprint };
  }

  return { attempts: maxAttempts };
}
