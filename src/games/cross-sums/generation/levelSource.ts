import type { CrossSumsLevel } from '../types';
import { difficultyParams, INITIAL_SKILL_RATING, maxAttemptsFor, type SkillRating } from './difficulty';
import { generateCrossSumsLevel, type GenerateFailure, type GenerateSuccess } from './generator';
import { mulberry32, seedFromLevelIndex } from './rng';

/**
 * Pure function of (levelIndex, skillRating, recentFingerprints): the seed is
 * derived solely from the level index, so replaying the same index with the
 * same history always reconstructs the same puzzle. Callers persist the
 * resulting level once created rather than re-deriving it, since a player's
 * skill rating moves on after that -- see useCrossSumsProgress.
 */
export function createLevelForIndex(
  levelIndex: number,
  skillRating: SkillRating,
  recentFingerprints: string[]
): GenerateSuccess | GenerateFailure {
  const rng = mulberry32(seedFromLevelIndex(levelIndex));
  const params = difficultyParams(skillRating);
  return generateCrossSumsLevel(rng, params, recentFingerprints, maxAttemptsFor(params));
}

/**
 * Same as `createLevelForIndex`, but never fails: relaxes the request in
 * stages (drop the recent-shape de-dup constraint, then fall back toward the
 * gentle baseline rating) before finally trying a small fixed-size board on a
 * fresh seed stream. Uniqueness at these sizes is found on essentially the
 * first attempt in practice (see the checkpoint sweep), so this ladder
 * exists so a player is never left without a level, not because it's
 * expected to be reached.
 */
export function createLevelForIndexRobust(levelIndex: number, skillRating: SkillRating, recentFingerprints: string[]): CrossSumsLevel {
  const attempts: Array<() => GenerateSuccess | GenerateFailure> = [
    () => createLevelForIndex(levelIndex, skillRating, recentFingerprints),
    () => createLevelForIndex(levelIndex, skillRating, []),
    () => createLevelForIndex(levelIndex, INITIAL_SKILL_RATING, []),
  ];
  for (const attempt of attempts) {
    const result = attempt();
    if ('level' in result) return result.level;
  }

  const rng = mulberry32(seedFromLevelIndex(levelIndex, 1));
  const lastResort = generateCrossSumsLevel(
    rng,
    { rowsRange: [4, 4], colsRange: [4, 4], keepDensity: [0.45, 0.55] },
    [],
    4000
  );
  if ('level' in lastResort) return lastResort.level;
  throw new Error(`Cross Sums level generation failed for index ${levelIndex}`);
}
