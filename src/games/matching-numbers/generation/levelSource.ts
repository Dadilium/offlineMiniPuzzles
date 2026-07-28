import type { BoardBuildParams } from './boardBuilder';
import { difficultyParams, INITIAL_SKILL_RATING, maxAttemptsFor, type SkillRating } from './difficulty';
import { generateMatchingNumbersLevel, type GenerateFailure, type GenerateSuccess } from './generator';
import { mulberry32, seedFromLevelIndex } from './rng';
import type { MatchingNumbersLevel } from '../types';

/** Pure function of (levelIndex, skillRating, recentFingerprints) -- seed derives only from levelIndex, so the same index always reconstructs the same puzzle. */
export function createLevelForIndex(
  levelIndex: number,
  skillRating: SkillRating,
  recentFingerprints: string[]
): GenerateSuccess | GenerateFailure {
  const rng = mulberry32(seedFromLevelIndex(levelIndex));
  const params = difficultyParams(skillRating);
  return generateMatchingNumbersLevel(rng, params, recentFingerprints, maxAttemptsFor());
}

const LAST_RESORT_BOARD_PARAMS: BoardBuildParams = { complexPairTarget: 2, bendBias: 0.1, candidatePoolCap: 40, backtrackBudget: 4000 };

/**
 * Fallback ladder, never fails in practice -- same shape as Kings'
 * createLevelForIndexRobust: (1) full request -> (2) drop de-dup -> (3) also
 * reset skill rating -> (4) last-resort fixed small board, fresh salted seed.
 */
export function createLevelForIndexRobust(levelIndex: number, skillRating: SkillRating, recentFingerprints: string[]): MatchingNumbersLevel {
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
  const lastResort = generateMatchingNumbersLevel(
    rng,
    { rowsRange: [4, 4], colsRange: [4, 4], equalWeight: 0.7, boardParams: LAST_RESORT_BOARD_PARAMS },
    [],
    4000
  );
  if ('level' in lastResort) return lastResort.level;
  throw new Error(`Matching Numbers level generation failed for index ${levelIndex}`);
}
