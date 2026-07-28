import type { KingsLevel } from '../types';
import { difficultyParams, INITIAL_SKILL_RATING, maxAttemptsFor, type SkillRating } from './difficulty';
import { generateKingsLevel, type GenerateFailure, type GenerateSuccess } from './generator';
import { mulberry32, seedFromLevelIndex } from './rng';

/**
 * Pure function of (levelIndex, skillRating, recentFingerprints): the seed is
 * derived solely from the level index, so replaying the same index with the
 * same history always reconstructs the same puzzle. Callers persist the
 * resulting level once created rather than re-deriving it, since a player's
 * skill rating moves on after that -- see useKingsProgress.
 */
export function createLevelForIndex(
  levelIndex: number,
  skillRating: SkillRating,
  recentFingerprints: string[]
): GenerateSuccess | GenerateFailure {
  const rng = mulberry32(seedFromLevelIndex(levelIndex));
  const params = difficultyParams(skillRating);
  return generateKingsLevel(rng, params, recentFingerprints, maxAttemptsFor(params));
}

/**
 * Same as `createLevelForIndex`, but never fails: relaxes the request in
 * stages (drop the recent-shape de-dup constraint, then fall back toward the
 * gentle baseline rating) before finally trying the widest possible band
 * (n 5-9, easy tier, no de-dup) on a fresh seed stream. At n<=9 with a 4000-
 * attempt budget per stage, the first stage succeeds in practice essentially
 * always -- this ladder exists so a player is never left without a level,
 * not because it's expected to be reached.
 */
export function createLevelForIndexRobust(levelIndex: number, skillRating: SkillRating, recentFingerprints: string[]): KingsLevel {
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
  const lastResort = generateKingsLevel(
    rng,
    { nRange: [5, 5], requiredTier: 'easy', styleWeights: { uniform: 1, directional: 0 } },
    [],
    4000
  );
  if ('level' in lastResort) return lastResort.level;
  throw new Error(`Kings level generation failed for index ${levelIndex}`);
}
