import type { FindWordsLevel } from '../types';
import { difficultyParams, maxGridAttemptsFor, tierKeyFor, type SkillRating } from './difficulty';
import { generateFindWordsLevel, type GenerateFailure, type GenerateSuccess } from './generator';
import { mulberry32, seedFromLevelIndex } from './rng';
import { SAFE_BOARDS } from './safeBoards';
import type { WordBankLanguage } from './wordbanks';

function areaBudgetFor(params: ReturnType<typeof difficultyParams>): number {
  return params.sizeRange[1] * params.sizeRange[1];
}

/**
 * Pure function of (levelIndex, skillRating, language, recentFingerprints):
 * the seed is derived solely from the level index, so replaying the same
 * index with the same history always reconstructs the same puzzle. Callers
 * persist the resulting level once created (see state/useFindWordsProgress)
 * rather than re-deriving it, since both skill rating and the player's app
 * language can move on after that.
 */
export function createLevelForIndex(
  levelIndex: number,
  skillRating: SkillRating,
  language: WordBankLanguage,
  recentFingerprints: string[]
): GenerateSuccess | GenerateFailure {
  const rng = mulberry32(seedFromLevelIndex(levelIndex));
  const params = difficultyParams(skillRating);
  return generateFindWordsLevel(rng, params, language, recentFingerprints, maxGridAttemptsFor(areaBudgetFor(params)));
}

/**
 * Same as `createLevelForIndex`, but never fails. Word placement essentially
 * never exhausts its budget in practice (unlike Shikaku's uniqueness-
 * certified subdivision), so this ladder is a safety net, not the common
 * path: relax the recent-shape dedup constraint, then spend far more search
 * budget on a fresh seed at the SAME tier, and only as a genuine last resort
 * fall back to a precomputed board matched to the player's current tier AND
 * language (see safeBoards.ts) -- never a lower tier's board, per CLAUDE.md's
 * "never fall back to a lesser solution" rule.
 */
export function createLevelForIndexRobust(
  levelIndex: number,
  skillRating: SkillRating,
  language: WordBankLanguage,
  recentFingerprints: string[]
): FindWordsLevel {
  const params = difficultyParams(skillRating);
  const attempts: Array<() => GenerateSuccess | GenerateFailure> = [
    () => createLevelForIndex(levelIndex, skillRating, language, recentFingerprints),
    () => createLevelForIndex(levelIndex, skillRating, language, []),
    () =>
      generateFindWordsLevel(
        mulberry32(seedFromLevelIndex(levelIndex, 1)),
        params,
        language,
        [],
        maxGridAttemptsFor(areaBudgetFor(params)) * 4
      ),
  ];
  for (const attempt of attempts) {
    const result = attempt();
    if ('level' in result) return result.level;
  }

  const safe = SAFE_BOARDS[language][tierKeyFor(skillRating)];
  if (!safe) throw new Error(`Find Words level generation failed for index ${levelIndex} at rating ${skillRating} (${language})`);
  return safe;
}
