import type { BlockFillLevel, Cell } from '../types';
import type { GenerationParams } from './difficulty';
import { fingerprintBlockFill } from './fingerprint';
import { growPath } from './pathGrowth';
import type { RNG } from './rng';

export interface GenerateSuccess {
  level: BlockFillLevel;
  attempts: number;
  fingerprint: string;
}

export interface GenerateFailure {
  attempts: number;
}

function fillableFromPath(rows: number, cols: number, path: Cell[]): boolean[][] {
  const grid = Array.from({ length: rows }, () => Array<boolean>(cols).fill(false));
  for (const { r, c } of path) grid[r][c] = true;
  return grid;
}

/**
 * The guaranteed-solvable board generator, same shape as Matching Numbers'
 * `buildBoard`: `growPath`'s walk IS a witness solution by construction (its
 * visited cells become `fillable`, unvisited become obstacles, its first
 * cell becomes `start`), so there's no solver-verification pass here and no
 * "reject and retry because it's not unique enough" loop -- an open board
 * legitimately has many valid fill orders, and that's fine, since the
 * mechanic never required uniqueness to feel like a puzzle once boards are
 * mostly-open rather than maze-tight. The only reasons to retry are the
 * fingerprint de-dup check or `growPath` falling short of `minFillRatio`.
 */
export function generateBlockFillLevel(
  rng: RNG,
  params: GenerationParams,
  recentFingerprints: string[] = [],
  maxAttempts = 200
): GenerateSuccess | GenerateFailure {
  const [rowsMin, rowsMax] = params.rowsRange;
  const [colsMin, colsMax] = params.colsRange;
  const recent = new Set(recentFingerprints);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const rows = rowsMin === rowsMax ? rowsMin : rowsMin + Math.floor(rng() * (rowsMax - rowsMin + 1));
    const cols = colsMin === colsMax ? colsMin : colsMin + Math.floor(rng() * (colsMax - colsMin + 1));
    const path = growPath(rows, cols, rng, params.minFillRatio, params.backtrackBudget);
    if (!path) continue;

    const fillable = fillableFromPath(rows, cols, path);
    const fingerprint = fingerprintBlockFill(fillable);
    if (recent.has(fingerprint)) continue;

    const level: BlockFillLevel = { rows, cols, fillable, start: path[0], solutionPath: path };
    return { level, attempts: attempt, fingerprint };
  }

  return { attempts: maxAttempts };
}
