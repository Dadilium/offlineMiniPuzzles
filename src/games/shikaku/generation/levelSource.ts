import type { ShikakuLevel } from '../types';
import { difficultyParams, maxAttemptsFor, tierKeyFor, type SkillRating } from './difficulty';
import { generateShikakuLevel, type GenerateFailure, type GenerateSuccess } from './generator';
import { mulberry32, seedFromLevelIndex } from './rng';
import { SAFE_BOARDS } from './safeBoards';

function areaBudgetFor(params: ReturnType<typeof difficultyParams>): number {
  return params.rowsRange[1] * params.colsRange[1];
}

/**
 * Pure function of (levelIndex, skillRating, recentFingerprints): the seed is
 * derived solely from the level index, so replaying the same index with the
 * same history always reconstructs the same puzzle. Callers persist the
 * resulting level once created rather than re-deriving it, since a player's
 * skill rating moves on after that -- see state/useShikakuProgress.
 */
export function createLevelForIndex(
  levelIndex: number,
  skillRating: SkillRating,
  recentFingerprints: string[]
): GenerateSuccess | GenerateFailure {
  const rng = mulberry32(seedFromLevelIndex(levelIndex));
  const params = difficultyParams(skillRating);
  return generateShikakuLevel(rng, params, recentFingerprints, maxAttemptsFor(areaBudgetFor(params)));
}

/**
 * Same as `createLevelForIndex`, but never fails. Like Tents & Trees' robust
 * wrapper, this deliberately does NOT end in one universal easy board --
 * silently downgrading a hard-tier player's board would violate CLAUDE.md's
 * "never fall back to a lesser solution" rule. Instead: relax only the
 * recent-shape dedup constraint, then spend more search budget on a fresh
 * seed at the SAME tier, and only as a genuine last resort fall back to a
 * precomputed board matched to the player's current tier (see
 * safeBoards.ts) -- never a lower tier's board.
 */
export function createLevelForIndexRobust(levelIndex: number, skillRating: SkillRating, recentFingerprints: string[]): ShikakuLevel {
  const params = difficultyParams(skillRating);
  const attempts: Array<() => GenerateSuccess | GenerateFailure> = [
    () => createLevelForIndex(levelIndex, skillRating, recentFingerprints),
    () => createLevelForIndex(levelIndex, skillRating, []),
    () =>
      generateShikakuLevel(
        mulberry32(seedFromLevelIndex(levelIndex, 1)),
        params,
        [],
        maxAttemptsFor(areaBudgetFor(params)) * 2
      ),
  ];
  for (const attempt of attempts) {
    const result = attempt();
    if ('level' in result) return result.level;
  }

  const safe = SAFE_BOARDS[tierKeyFor(skillRating)];
  if (!safe) throw new Error(`Shikaku level generation failed for index ${levelIndex} at rating ${skillRating}`);
  return safe;
}
