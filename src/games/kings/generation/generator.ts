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

/** Once a tier-matching board is found, how many more attempts to spend
 * hunting for a board that needs more elimination-solver rounds (a proxy
 * for "the deduction chain is longer/less obvious") before settling. Flat
 * rather than scaled by board size on purpose: cheap sizes (where matches
 * are common) get several extra candidates to pick from almost for free,
 * while rare sizes (n=8-9, where a single match can already cost thousands
 * of attempts) mostly exhaust this window without finding a second one and
 * fall back to the first match -- self-scaling without per-size tuning. */
const EXTRA_ATTEMPTS_FOR_QUALITY = 3000;

/**
 * Pure, seeded rejection-sampling search: generate random regions (varying
 * size and growth style per attempt), keep the best layout that (a)
 * `solveKings` confirms has exactly one solution, (b) isn't a near-duplicate
 * of a recently-served shape, and (c) requires exactly the reasoning tier
 * `params.requiredTier` asks for -- "best" meaning the most elimination
 * rounds among candidates found within `EXTRA_ATTEMPTS_FOR_QUALITY` attempts
 * of the first match. Never returns a level that needs guessing/backtracking
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
  let extraAttemptsLeft = EXTRA_ATTEMPTS_FOR_QUALITY;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (best !== null) {
      extraAttemptsLeft--;
      if (extraAttemptsLeft <= 0) return best;
    }

    const n = nMin === nMax ? nMin : nMin + Math.floor(rng() * (nMax - nMin + 1));
    const style = pickStyle(rng, params.styleWeights);
    const regions = generateRegions(n, rng, style);
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

    const tier: 'easy' | 'medium' = elimination.usedLockedCandidates ? 'medium' : 'easy';
    if (tier !== params.requiredTier) {
      yield best;
      continue;
    }

    const candidate: GenerateSuccess = { level, attempts: attempt, tier, rounds: elimination.rounds, fingerprint };
    if (!best || candidate.rounds > best.rounds) best = candidate;
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
