import type { KingsLevel } from '../types';
import { difficultyParams, INITIAL_SKILL_RATING, maxAttemptsFor, stepDownRating, type SkillRating } from './difficulty';
import { generateKingsLevelAsync, type GenerateFailure, type GenerateSuccess } from './generator';
import { mulberry32, seedFromLevelIndex } from './rng';

/**
 * Pure function of (levelIndex, skillRating, recentFingerprints): the seed is
 * derived solely from the level index, so replaying the same index with the
 * same history always reconstructs the same puzzle. Callers persist the
 * resulting level once created rather than re-deriving it, since a player's
 * skill rating moves on after that -- see useKingsProgress. Runs via the
 * chunked-yield generator so a slow n=8-9 search never blocks the JS thread.
 */
export async function createLevelForIndex(
  levelIndex: number,
  skillRating: SkillRating,
  recentFingerprints: string[],
  deadlineMs?: number
): Promise<GenerateSuccess | GenerateFailure> {
  const rng = mulberry32(seedFromLevelIndex(levelIndex));
  const params = difficultyParams(skillRating);
  return generateKingsLevelAsync(rng, params, recentFingerprints, maxAttemptsFor(params), deadlineMs);
}

export interface GenerationDeadlines {
  primaryMs: number;
  stepDownMs: number;
  baselineMs: number;
  lastResortMs: number;
}

/**
 * Used when generation is requested just-in-time for a level the player is
 * actively waiting on (the on-screen loading state) -- bounds the whole
 * ladder to a few seconds, since a visible wait needs a hard ceiling. A
 * unique, guess-free, in-tier board at n=8-9 is rare and highly variable to
 * find (measured ~1-in-2,000 to 1-in-10,000 random layouts), so an
 * attempt-count budget alone has an unbounded worst-case latency -- observed
 * as long as several minutes in testing.
 */
export const URGENT_DEADLINES: GenerationDeadlines = {
  primaryMs: 2000,
  stepDownMs: 1500,
  baselineMs: 1000,
  lastResortMs: 700,
};

/**
 * Used when generation is kicked off ahead of need (prefetching the next
 * level or two while the player is still busy with the current one) --
 * nothing is waiting on it, so it can hold out much longer for the true
 * skill-matched board before settling for an easier rung.
 */
export const BACKGROUND_DEADLINES: GenerationDeadlines = {
  primaryMs: 20000,
  stepDownMs: 8000,
  baselineMs: 3000,
  lastResortMs: 1000,
};

/**
 * Same as `createLevelForIndex`, but never fails: relaxes the request in
 * stages before finally trying the widest possible band (n=5, easy tier, no
 * de-dup) on a fresh seed stream. The middle rung steps the skill rating
 * *down* rather than dropping straight to the gentle baseline -- dropping
 * recentFingerprints alone (retrying the exact same difficulty) rarely
 * helps, since rarity of a valid board is the bottleneck, not de-dup
 * collisions; a real step down (e.g. n=9 -> n=8) means a player who times
 * out at the top of the skill range still lands on a hard board, not a
 * beginner one. Each rung is capped per `deadlines` -- this ladder exists so
 * a player is never left without a level at all, not because any cap is
 * expected to be hit often.
 */
export async function createLevelForIndexRobust(
  levelIndex: number,
  skillRating: SkillRating,
  recentFingerprints: string[],
  deadlines: GenerationDeadlines = URGENT_DEADLINES
): Promise<KingsLevel> {
  const attempts: Array<() => Promise<GenerateSuccess | GenerateFailure>> = [
    () => createLevelForIndex(levelIndex, skillRating, recentFingerprints, deadlines.primaryMs),
    () => createLevelForIndex(levelIndex, stepDownRating(skillRating), [], deadlines.stepDownMs),
    () => createLevelForIndex(levelIndex, INITIAL_SKILL_RATING, [], deadlines.baselineMs),
  ];
  for (const attempt of attempts) {
    const result = await attempt();
    if ('level' in result) return result.level;
  }

  const rng = mulberry32(seedFromLevelIndex(levelIndex, 1));
  const lastResort = await generateKingsLevelAsync(
    rng,
    { nRange: [5, 5], requiredTier: 'easy', styleWeights: { uniform: 1, directional: 0, thin: 0, jagged: 0 } },
    [],
    4000,
    deadlines.lastResortMs
  );
  if ('level' in lastResort) return lastResort.level;
  throw new Error(`Kings level generation failed for index ${levelIndex}`);
}
