import type { ArrowsLevel } from '../types';
import { difficultyParams, MAX_ATTEMPTS, type SkillRating } from './difficulty';
import { generateArrowsLevel, generateArrowsLevelAsync, type Candidate, type GenerateFailure, type GenerateSuccess } from './generator';
import { mulberry32, seedFromLevelIndex } from './rng';

/**
 * Pure function of (levelIndex, skillRating, recentFingerprints, salt): the
 * seed comes solely from the level index (+ salt), so the same inputs always
 * rebuild the same board. Callers persist the result rather than re-deriving
 * it, since the player's rating moves on afterwards -- see
 * state/useArrowsProgress.
 */
export function createLevelForIndex(
  levelIndex: number,
  skillRating: SkillRating,
  recentFingerprints: string[],
  salt = 0
): GenerateSuccess | GenerateFailure {
  const rng = mulberry32(seedFromLevelIndex(levelIndex, salt));
  return generateArrowsLevel(rng, difficultyParams(skillRating), recentFingerprints, MAX_ATTEMPTS);
}

/** Async twin of `createLevelForIndex` -- identical output, yields between attempts. */
export function createLevelForIndexAsync(
  levelIndex: number,
  skillRating: SkillRating,
  recentFingerprints: string[],
  salt = 0
): Promise<GenerateSuccess | GenerateFailure> {
  const rng = mulberry32(seedFromLevelIndex(levelIndex, salt));
  return generateArrowsLevelAsync(rng, difficultyParams(skillRating), recentFingerprints, MAX_ATTEMPTS);
}

/** Extra seeds tried, as a last resort, before giving up entirely. */
const LAST_RESORT_SALTS = 10;

/**
 * Every attempt the robust wrappers make, in order. All at the player's own
 * tier (same board size, same arrow lengths), so the board is never easier
 * than they picked: first relax only the recent-board dedup, then spend
 * fresh seeds. Every board tried is 100% full and solvable by construction.
 */
function robustPlan(recentFingerprints: string[]): Array<{ salt: number; recent: string[] }> {
  return [
    { salt: 0, recent: recentFingerprints },
    { salt: 1, recent: [] },
    { salt: 2, recent: [] },
    ...Array.from({ length: LAST_RESORT_SALTS }, (_, i) => ({ salt: 3 + i, recent: [] })),
  ];
}

/** After the first three passes miss their gates, the hardest full board seen so far is served rather than burning more seeds. */
const PASSES_BEFORE_BEST = 3;

function settle(results: Array<GenerateSuccess | GenerateFailure>): ArrowsLevel | 'continue' {
  const last = results[results.length - 1];
  if ('level' in last) return last.level;
  if (results.length < PASSES_BEFORE_BEST) return 'continue';
  let best: Candidate | null = null;
  for (const result of results) {
    if ('best' in result && result.best && (!best || result.best.analysis.rounds > best.analysis.rounds)) best = result.best;
  }
  return best ? best.level : 'continue';
}

/** Never fails, never hands out an easier board -- see `robustPlan`. */
export function createLevelForIndexRobust(levelIndex: number, skillRating: SkillRating, recentFingerprints: string[]): ArrowsLevel {
  const results: Array<GenerateSuccess | GenerateFailure> = [];
  for (const { salt, recent } of robustPlan(recentFingerprints)) {
    results.push(createLevelForIndex(levelIndex, skillRating, recent, salt));
    const settled = settle(results);
    if (settled !== 'continue') return settled;
  }
  throw new Error(`Arrows level generation failed for index ${levelIndex} at rating ${skillRating}`);
}

/** Async twin of `createLevelForIndexRobust` -- what the app uses. */
export async function createLevelForIndexRobustAsync(levelIndex: number, skillRating: SkillRating, recentFingerprints: string[]): Promise<ArrowsLevel> {
  const results: Array<GenerateSuccess | GenerateFailure> = [];
  for (const { salt, recent } of robustPlan(recentFingerprints)) {
    results.push(await createLevelForIndexAsync(levelIndex, skillRating, recent, salt));
    const settled = settle(results);
    if (settled !== 'continue') return settled;
  }
  throw new Error(`Arrows level generation failed for index ${levelIndex} at rating ${skillRating}`);
}
