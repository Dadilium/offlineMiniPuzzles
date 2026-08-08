import { buildBoard, buildPairPlan, pickDims } from './boardBuilder';
import type { GenerationParams } from './difficulty';
import { fingerprintGrid } from './fingerprint';
import type { RNG } from './rng';
import type { MatchingNumbersLevel } from '../types';

export interface GenerateSuccess {
  level: MatchingNumbersLevel;
  attempts: number;
  fingerprint: string;
}

export interface GenerateFailure {
  attempts: number;
}

/**
 * buildBoard never hard-fails (see boardBuilder.ts -- worst case it falls
 * back to a shuffle that didn't quite hit the headstart target), so the only
 * reason to retry here is the fingerprint de-dup check rejecting a
 * near-repeat of a recently-served board -- a handful of attempts is plenty;
 * this loop (and the GenerateFailure case) exists mainly so a pathological
 * recentFingerprints history can never hang generation.
 */
export function generateMatchingNumbersLevel(
  rng: RNG,
  params: GenerationParams,
  recentFingerprints: string[] = [],
  maxAttempts = 10
): GenerateSuccess | GenerateFailure {
  const recent = new Set(recentFingerprints);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { rows, cols } = pickDims(rng, params.rowsRange, params.colsRange);
    const m = (rows * cols) / 2;
    const pairPlan = buildPairPlan(rng, m, params.equalWeight);

    const built = buildBoard(rng, rows, cols, pairPlan, params.boardParams);
    const fingerprint = fingerprintGrid(built.grid);
    if (recent.has(fingerprint)) continue;

    const level: MatchingNumbersLevel = { rows, cols, grid: built.grid };
    return { level, attempts: attempt, fingerprint };
  }

  return { attempts: maxAttempts };
}
