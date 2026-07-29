import type { ColorSortLevel, Tube } from '../types';
import type { GenerationParams } from './difficulty';
import { fingerprintColorSort } from './fingerprint';
import type { RNG } from './rng';
import { solveColorSort } from './solver';

export interface GenerateSuccess {
  level: ColorSortLevel;
  attempts: number;
  fingerprint: string;
}

export interface GenerateFailure {
  attempts: number;
}

function randInt(rng: RNG, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/**
 * Deals `colorsCount` full sets of `capacity` units each into `colorsCount`
 * tubes (plus `extraEmpty` empties) via a seeded Fisher-Yates shuffle.
 *
 * Deliberately NOT "scramble via a random walk of legal pours from the
 * solved state": from the solved state, the only legal moves are full-tube
 * -> empty-tube, which preserves the solved invariant by induction (every
 * non-empty tube stays full-monochrome, just on a different physical tube)
 * -- such a walk can never leave that trivial orbit, so it can't produce a
 * mixed board at all. Random-deal + solver-verified rejection sampling is
 * the only sound approach, mirroring every other game's generator shape.
 */
function dealRandomTubes(rng: RNG, colorsCount: number, capacity: number, extraEmpty: number): Tube[] {
  const bag: number[] = [];
  for (let color = 0; color < colorsCount; color++) {
    for (let i = 0; i < capacity; i++) bag.push(color);
  }
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }

  const tubes: Tube[] = [];
  for (let t = 0; t < colorsCount; t++) tubes.push(bag.slice(t * capacity, (t + 1) * capacity));
  for (let e = 0; e < extraEmpty; e++) tubes.push([]);
  return tubes;
}

/**
 * Pure, seeded rejection-sampling search: deal a random board, then keep
 * the first attempt where (a) it isn't a near-duplicate of a recently
 * served board, (b) the certifying BFS proves it solvable within the
 * tier's state budget (never ships an unproven board -- a truncated result
 * is treated exactly like an unsolvable one here, just retried), and (c)
 * the shortest solve found is at least the tier's `minSolutionMoves` --
 * rejecting a too-easy roll rather than silently shipping a softer board
 * for a harder tier.
 */
export function generateColorSortLevel(
  rng: RNG,
  params: GenerationParams,
  recentFingerprints: string[] = [],
  maxAttempts = 3000
): GenerateSuccess | GenerateFailure {
  const recent = new Set(recentFingerprints);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const colorsCount = randInt(rng, params.colorsRange[0], params.colorsRange[1]);
    const extraEmpty = randInt(rng, params.extraEmptyRange[0], params.extraEmptyRange[1]);
    const { capacity } = params;

    const tubes = dealRandomTubes(rng, colorsCount, capacity, extraEmpty);
    const fingerprint = fingerprintColorSort(tubes, capacity);
    if (recent.has(fingerprint)) continue;

    const result = solveColorSort(tubes, capacity, { maxStates: params.solverStateBudget });
    if (!result.solvable || result.truncated || !result.moves) continue;
    if (result.moves.length < params.minSolutionMoves) continue;

    const level: ColorSortLevel = { capacity, colors: colorsCount, tubes, parMoves: result.moves.length };
    return { level, attempts: attempt, fingerprint };
  }

  return { attempts: maxAttempts };
}
