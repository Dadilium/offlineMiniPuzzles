import type { CrossSumsLevel } from '../types';
import type { GenerationParams } from './difficulty';
import { fingerprintCrossSums } from './fingerprint';
import type { RNG } from './rng';
import { solveCrossSums } from './solver';

export interface GenerateSuccess {
  level: CrossSumsLevel;
  attempts: number;
  fingerprint: string;
}

export interface GenerateFailure {
  attempts: number;
}

const MIN_DIGIT = 1;
const MAX_DIGIT = 9;

function randInt(rng: RNG, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/**
 * Pure, seeded rejection-sampling search: pick a random size + digit grid +
 * keep/exclude mask, derive row/col targets from that mask, then keep the
 * first attempt where (a) the mask isn't a near-duplicate of a recently
 * served board and (b) `solveCrossSums` confirms it's the *only* mask
 * satisfying every row and column target simultaneously. Same shape as
 * `generateKingsLevel` -- never ships an ambiguous board, fails outright
 * rather than quietly serving one within `maxAttempts`.
 */
export function generateCrossSumsLevel(
  rng: RNG,
  params: GenerationParams,
  recentFingerprints: string[] = [],
  maxAttempts = 4000
): GenerateSuccess | GenerateFailure {
  const recent = new Set(recentFingerprints);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const rows = randInt(rng, params.rowsRange[0], params.rowsRange[1]);
    const cols = randInt(rng, params.colsRange[0], params.colsRange[1]);

    const grid: number[][] = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => randInt(rng, MIN_DIGIT, MAX_DIGIT))
    );

    const density = params.keepDensity[0] + rng() * (params.keepDensity[1] - params.keepDensity[0]);
    const mask: boolean[][] = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => rng() < density)
    );

    const rowTargets = grid.map((row, r) => row.reduce((sum, v, c) => sum + (mask[r][c] ? v : 0), 0));
    const colTargets = Array.from({ length: cols }, (_, c) =>
      grid.reduce((sum, row, r) => sum + (mask[r][c] ? row[c] : 0), 0)
    );

    const fingerprint = fingerprintCrossSums(grid, rowTargets, colTargets);
    if (recent.has(fingerprint)) continue;

    const level: CrossSumsLevel = { rows, cols, grid, rowTargets, colTargets, solutionMask: mask };
    const solutions = solveCrossSums(level, 2);
    if (solutions.length !== 1) continue;

    return { level, attempts: attempt, fingerprint };
  }

  return { attempts: maxAttempts };
}
