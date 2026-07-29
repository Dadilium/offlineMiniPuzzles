import type { ColorSortLevel } from '../types';
import { difficultyParams, maxAttemptsFor, tierKeyFor, type SkillRating } from './difficulty';
import { generateColorSortLevel, type GenerateFailure, type GenerateSuccess } from './generator';
import { mulberry32, seedFromLevelIndex } from './rng';
import { SAFE_BOARDS } from './safeBoards';

/**
 * Pure function of (levelIndex, skillRating, recentFingerprints): the seed is
 * derived solely from the level index, so replaying the same index with the
 * same history always reconstructs the same puzzle. Callers persist the
 * resulting level once created rather than re-deriving it, since a player's
 * skill rating moves on after that -- see state/useColorSortProgress.
 */
export function createLevelForIndex(
  levelIndex: number,
  skillRating: SkillRating,
  recentFingerprints: string[]
): GenerateSuccess | GenerateFailure {
  const rng = mulberry32(seedFromLevelIndex(levelIndex));
  const params = difficultyParams(skillRating);
  return generateColorSortLevel(rng, params, recentFingerprints, maxAttemptsFor(params));
}

/**
 * Same as `createLevelForIndex`, but never fails. Unlike the other games'
 * robust wrappers, this deliberately does NOT end in one universal easy
 * board -- silently downgrading a hard-tier player's board would violate
 * CLAUDE.md's "never fall back to a lesser solution" rule. Instead: relax
 * only the recent-shape dedup constraint, then spend more search budget on
 * a fresh seed at the SAME tier, and only as a genuine last resort fall
 * back to a precomputed board matched to the player's current tier (see
 * safeBoards.ts) -- never a lower tier's board. The sweep script shows
 * generation succeeds within a few hundred attempts even at the hardest
 * tier, so this ladder exists purely so a player is never left without a
 * level, not because it's expected to be reached.
 */
export function createLevelForIndexRobust(levelIndex: number, skillRating: SkillRating, recentFingerprints: string[]): ColorSortLevel {
  const params = difficultyParams(skillRating);
  const attempts: Array<() => GenerateSuccess | GenerateFailure> = [
    () => createLevelForIndex(levelIndex, skillRating, recentFingerprints),
    () => createLevelForIndex(levelIndex, skillRating, []),
    () => generateColorSortLevel(mulberry32(seedFromLevelIndex(levelIndex, 1)), params, [], maxAttemptsFor(params) * 2),
  ];
  for (const attempt of attempts) {
    const result = attempt();
    if ('level' in result) return result.level;
  }

  const safe = SAFE_BOARDS[tierKeyFor(skillRating)];
  if (!safe) throw new Error(`Color Sort level generation failed for index ${levelIndex} at rating ${skillRating}`);
  return safe;
}
