import type { BlockFillLevel } from '../types';
import { difficultyParams, maxAttemptsFor, type SkillRating } from './difficulty';
import { tierFloor } from '../../../state/difficultyTiers';
import { generateBlockFillLevel, type GenerateFailure, type GenerateSuccess } from './generator';
import { mulberry32, seedFromLevelIndex } from './rng';

/**
 * Pure function of (levelIndex, skillRating, recentFingerprints): the seed is
 * derived solely from the level index, so replaying the same index with the
 * same history always reconstructs the same puzzle. Same contract as Kings'
 * `createLevelForIndex`.
 */
export function createLevelForIndex(
  levelIndex: number,
  skillRating: SkillRating,
  recentFingerprints: string[]
): GenerateSuccess | GenerateFailure {
  const rng = mulberry32(seedFromLevelIndex(levelIndex));
  const params = difficultyParams(skillRating);
  return generateBlockFillLevel(rng, params, recentFingerprints, maxAttemptsFor());
}

/**
 * Same as `createLevelForIndex`, but never fails: relaxes the request in
 * stages (drop the recent-shape de-dup constraint, then fall back to the floor of the
 * player's difficulty tier -- never an easier tier) before finally trying the smallest, most
 * permissive band on a fresh seed stream. Same ladder as Kings'
 * `createLevelForIndexRobust`.
 */
export function createLevelForIndexRobust(levelIndex: number, skillRating: SkillRating, recentFingerprints: string[]): BlockFillLevel {
  const attempts: Array<() => GenerateSuccess | GenerateFailure> = [
    () => createLevelForIndex(levelIndex, skillRating, recentFingerprints),
    () => createLevelForIndex(levelIndex, skillRating, []),
    () => createLevelForIndex(levelIndex, tierFloor(skillRating), []),
  ];
  for (const attempt of attempts) {
    const result = attempt();
    if ('level' in result) return result.level;
  }

  const rng = mulberry32(seedFromLevelIndex(levelIndex, 1));
  const lastResort = generateBlockFillLevel(
    rng,
    { rowsRange: [8, 8], colsRange: [5, 5], minFillRatio: 0.7, backtrackBudget: 2000 },
    [],
    500
  );
  if ('level' in lastResort) return lastResort.level;
  throw new Error(`Block Fill level generation failed for index ${levelIndex}`);
}
