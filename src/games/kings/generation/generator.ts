import type { KingsLevel } from '../types';
import { solveByElimination } from './eliminationSolver';
import { fingerprintRegions } from './fingerprint';
import { generateRegions, type RegionStyle } from './regionGrowth';
import type { GenerationParams } from './difficulty';
import type { RNG } from './rng';
import { solveKings } from './solver';

export interface GenerateSuccess {
  level: KingsLevel;
  attempts: number;
  tier: 'easy' | 'medium';
  rounds: number;
  fingerprint: string;
}

export interface GenerateFailure {
  attempts: number;
}

function pickStyle(rng: RNG, weights: GenerationParams['styleWeights']): RegionStyle {
  const entries = Object.entries(weights) as Array<[RegionStyle, number]>;
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let x = rng() * total;
  for (const [style, w] of entries) {
    if (x < w) return style;
    x -= w;
  }
  return entries[0][0];
}

/**
 * Pure, seeded rejection-sampling search: generate random regions (varying
 * size and growth style per attempt), keep the first layout that (a)
 * `solveKings` confirms has exactly one solution, (b) isn't a near-duplicate
 * of a recently-served shape, and (c) requires exactly the reasoning tier
 * `params.requiredTier` asks for. Never returns a level that needs
 * guessing/backtracking to solve -- if nothing in-band turns up within
 * `maxAttempts`, it fails outright rather than quietly shipping something
 * easier, harder, or guessier than requested.
 */
export function generateKingsLevel(
  rng: RNG,
  params: GenerationParams,
  recentFingerprints: string[] = [],
  maxAttempts = 4000
): GenerateSuccess | GenerateFailure {
  const [nMin, nMax] = params.nRange;
  const recent = new Set(recentFingerprints);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const n = nMin === nMax ? nMin : nMin + Math.floor(rng() * (nMax - nMin + 1));
    const style = pickStyle(rng, params.styleWeights);
    const regions = generateRegions(n, rng, style);
    if (!regions) continue;

    const fingerprint = fingerprintRegions(regions);
    if (recent.has(fingerprint)) continue;

    const level: KingsLevel = { n, regions, solution: [] };
    const solutions = solveKings(level, 2);
    if (solutions.length !== 1) continue;
    level.solution = solutions[0].positions.map((p): [number, number] => [p.r, p.c]);

    const elimination = solveByElimination(level);
    if (!elimination.solved) continue; // never ship a guessy level

    const tier: 'easy' | 'medium' = elimination.usedLockedCandidates ? 'medium' : 'easy';
    if (tier !== params.requiredTier) continue;

    return { level, attempts: attempt, tier, rounds: elimination.rounds, fingerprint };
  }

  return { attempts: maxAttempts };
}
