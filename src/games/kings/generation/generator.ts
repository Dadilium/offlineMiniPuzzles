import type { KingsLevel } from '../types';
import { solveByElimination, type ReasoningTier } from './eliminationSolver';
import { fingerprintRegions } from './fingerprint';
import { generatePlantedRegions, generateRegions, type RegionStyle } from './regionGrowth';
import { constructionFor, type GenerationParams } from './difficulty';
import type { RNG } from './rng';
import { solveKings } from './solver';
import { repairToUnique } from './uniqueRepair';

export interface GenerateSuccess {
  level: KingsLevel;
  attempts: number;
  tier: ReasoningTier;
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

/** Once a tier-matching board is found, how many more attempts to spend
 * hunting for one that needs more elimination-solver rounds (a proxy for
 * "the deduction chain is longer/less obvious") before settling. The window
 * is a fraction of what the first match cost, so it scales with how rare
 * matches are at this size: a flat window (the old 3000) was most of the
 * total time on small boards and ~2s on 9x9 for a usually-fruitless hunt.
 * Counted in attempts rather than wall-clock so a given seed yields the same
 * board on every device. */
const QUALITY_WINDOW_RATIO = 0.5;
const QUALITY_WINDOW_MIN = 150;
const QUALITY_WINDOW_MAX = 3000;

function qualityWindowFor(firstMatchAttempt: number): number {
  return Math.max(QUALITY_WINDOW_MIN, Math.min(QUALITY_WINDOW_MAX, Math.ceil(firstMatchAttempt * QUALITY_WINDOW_RATIO)));
}

/** Repair steps allowed per planted layout before drawing a fresh one. */
const REPAIR_STEPS_PER_CELL = 0.5;

/** Planted layout repaired to a single solution, or null to retry. */
function plantedUniqueRegions(n: number, rng: RNG, style: RegionStyle): number[][] | null {
  const planted = generatePlantedRegions(n, rng, style);
  if (!planted) return null;
  return repairToUnique(planted.regions, planted.kingCols, rng, Math.ceil(n * n * REPAIR_STEPS_PER_CELL));
}

const TIER_RANK: Record<ReasoningTier, number> = { easy: 0, medium: 1, hard: 2 };

/** Pure: more elimination rounds wins, unless `preferHarderTier` makes a
 * harder reasoning tier win outright first. */
function isBetterCandidate(candidate: GenerateSuccess, best: GenerateSuccess, params: GenerationParams): boolean {
  if (params.preferHarderTier && TIER_RANK[candidate.tier] !== TIER_RANK[best.tier]) {
    return TIER_RANK[candidate.tier] > TIER_RANK[best.tier];
  }
  return candidate.rounds > best.rounds;
}

/**
 * Pure, seeded rejection-sampling search: draw region layouts (random or
 * planted per `constructionFor`, varying size and growth style per attempt),
 * keep the best layout that (a) `solveKings` confirms has exactly one
 * solution, (b) isn't a near-duplicate of a recently-served shape, and (c)
 * requires one of `params.allowedTiers` -- "best" per `isBetterCandidate`
 * among candidates found within `qualityWindowFor` attempts of the first
 * match. Never returns a level that needs guessing/backtracking
 * to solve -- if nothing in-band turns up within `maxAttempts`, it fails
 * outright rather than quietly shipping something easier, harder, or
 * guessier than requested.
 *
 * Yields the current best match (or null before the first one) rather than
 * void, so a caller that bails early (e.g. on a wall-clock deadline, see
 * `generateKingsLevelAsync`) can still use whatever was found so far instead
 * of discarding it. Shared by both the sync (`generateKingsLevel`, used by
 * the CLI) and async (`generateKingsLevelAsync`, used by the app) entry
 * points below -- each just drains this generator differently.
 */
function* searchKingsLevel(
  rng: RNG,
  params: GenerationParams,
  recent: Set<string>,
  maxAttempts: number
): Generator<GenerateSuccess | null, GenerateSuccess | GenerateFailure, void> {
  const [nMin, nMax] = params.nRange;
  let best: GenerateSuccess | null = null;
  let extraAttemptsLeft = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (best !== null) {
      extraAttemptsLeft--;
      if (extraAttemptsLeft <= 0) return best;
    }

    const n = nMin === nMax ? nMin : nMin + Math.floor(rng() * (nMax - nMin + 1));
    const style = pickStyle(rng, params.styleWeights);
    const construction = params.construction ?? constructionFor(n);
    const regions = construction === 'planted' ? plantedUniqueRegions(n, rng, style) : generateRegions(n, rng, style);
    if (!regions) {
      yield best;
      continue;
    }

    const fingerprint = fingerprintRegions(regions);
    if (recent.has(fingerprint)) {
      yield best;
      continue;
    }

    const level: KingsLevel = { n, regions, solution: [] };
    const solutions = solveKings(level, 2);
    if (solutions.length !== 1) {
      yield best;
      continue;
    }
    level.solution = solutions[0].positions.map((p): [number, number] => [p.r, p.c]);

    const elimination = solveByElimination(level);
    if (!elimination.solved) {
      yield best; // never ship a guessy level
      continue;
    }

    const tier = elimination.tier;
    if (!params.allowedTiers.includes(tier)) {
      yield best;
      continue;
    }

    const candidate: GenerateSuccess = { level, attempts: attempt, tier, rounds: elimination.rounds, fingerprint };
    if (!best) extraAttemptsLeft = qualityWindowFor(attempt);
    if (!best || isBetterCandidate(candidate, best, params)) best = candidate;
    yield best;
  }

  return best ?? { attempts: maxAttempts };
}

export function generateKingsLevel(
  rng: RNG,
  params: GenerationParams,
  recentFingerprints: string[] = [],
  maxAttempts = 4000
): GenerateSuccess | GenerateFailure {
  const search = searchKingsLevel(rng, params, new Set(recentFingerprints), maxAttempts);
  let step = search.next();
  while (!step.done) step = search.next();
  return step.value;
}

/** How long a single burst of attempts may run before yielding a tick back
 * to the JS event loop -- so touches, animations, and renders keep flowing
 * even while an n=8-9 search grinds through thousands of attempts. */
const MAX_CHUNK_MS = 12;

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Same search as `generateKingsLevel`, but never blocks the JS thread for
 * more than `MAX_CHUNK_MS` at a stretch -- used by the app's runtime level
 * source, since generation there can run for several seconds on large
 * boards and must never freeze the UI.
 *
 * `deadlineMs`, when given, bails out (as a `GenerateFailure`) once that much
 * wall-clock time has passed, regardless of `maxAttempts`. Acceptance rate
 * for a unique, guess-free, in-tier board is small and highly variable at
 * n=8-9 (measured ~1-in-2,000 to 1-in-10,000), so a fixed attempt count alone
 * has an unbounded worst-case latency -- the caller's fallback ladder
 * (`createLevelForIndexRobust`) relies on this deadline to guarantee the
 * *whole* ladder finishes within a bounded time, not just each rung.
 */
export async function generateKingsLevelAsync(
  rng: RNG,
  params: GenerationParams,
  recentFingerprints: string[] = [],
  maxAttempts = 4000,
  deadlineMs?: number
): Promise<GenerateSuccess | GenerateFailure> {
  const search = searchKingsLevel(rng, params, new Set(recentFingerprints), maxAttempts);
  const overallStart = Date.now();
  let step = search.next();
  let attemptsSoFar = 1;
  let chunkStart = overallStart;
  while (!step.done) {
    if (deadlineMs !== undefined && Date.now() - overallStart >= deadlineMs) {
      return step.value ?? { attempts: attemptsSoFar };
    }
    if (Date.now() - chunkStart >= MAX_CHUNK_MS) {
      await yieldToEventLoop();
      chunkStart = Date.now();
    }
    step = search.next();
    attemptsSoFar++;
  }
  return step.value;
}
