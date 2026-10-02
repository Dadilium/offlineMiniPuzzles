import type { RegionStyle } from './regionGrowth';
import { tierFloor, tierForRating } from '../../../state/difficultyTiers';
import type { ReasoningTier } from './eliminationSolver';

/** 0-100, starts around the middle-low so early levels are gentle. */
export type SkillRating = number;

export const INITIAL_SKILL_RATING: SkillRating = 40;

const MIN_RATING = 0;
const MAX_RATING = 100;
/** Per-level step. Bumped from 3 -> 5 (2026-07-31) so skill rating -- and
 * therefore grid size / reasoning tier -- climbs noticeably faster while
 * still moving in gradual nudges rather than spikes. */
const STEP = 5;

export interface LevelResult {
  hintsUsed: number;
  skipped: boolean;
}

/**
 * Pure reducer: given the previous rating and how the last level went,
 * returns the next rating. No hints used -> nudge up (found it too
 * comfortable). Two or more hints, or an outright skip -> nudge down (too
 * hard). Exactly one hint is treated as "about right" and doesn't move the
 * rating. Skips move it down harder than hints since a skip is a much
 * stronger "this was too much" signal than needing a nudge.
 */
export function nextSkillRating(prev: SkillRating, result: LevelResult): SkillRating {
  let delta = 0;
  if (result.skipped) delta = -STEP * 2;
  else if (result.hintsUsed >= 2) delta = -STEP;
  else if (result.hintsUsed === 0) delta = STEP;

  return Math.max(MIN_RATING, Math.min(MAX_RATING, prev + delta));
}

export interface GenerationParams {
  nRange: [number, number];
  /** Reasoning tiers (hardest elimination-solver technique needed) a level
   * may require -- anything else is rejected. */
  allowedTiers: ReasoningTier[];
  /** When several allowed tiers turn up, keep the hardest one found rather
   * than the first -- Expert wants lookahead boards whenever they exist. */
  preferHarderTier?: boolean;
  styleWeights: Record<RegionStyle, number>;
  /** Forces how region layouts are drawn; omitted = `constructionFor(n)`. */
  construction?: RegionConstruction;
}

export type RegionConstruction = 'random' | 'planted';

/**
 * 'planted' (kings first, then regions repaired to a unique solution) finds
 * usable boards several times faster from n=7 up and is the only way 10-11
 * are reachable at all -- but its repaired layouts essentially never solve by
 * hidden singles alone, so small boards (which must be 'easy') stay
 * 'random', which is already fast there. Measured with
 * `__scripts__/plantedSweep.ts`.
 */
export function constructionFor(n: number): RegionConstruction {
  return n >= 7 ? 'planted' : 'random';
}

const STYLE_WEIGHTS: Record<RegionStyle, number> = { uniform: 0.3, directional: 0.25, thin: 0.25, jagged: 0.2 };

/**
 * Pure mapping from a skill rating to generation parameters, one distinct
 * band per difficulty tier (see state/difficultyTiers) so each step the
 * player picks on the hub really plays differently:
 * - Easy: 5-6, hidden singles only ("easy" reasoning).
 * - Medium: 6-7, needs locked candidates ("medium").
 * - Hard: 7-8, then 8-9 in the upper half of the band; medium or hard
 *   (one-step lookahead) reasoning.
 * - Expert: 10x10, with 11x11 mixed in from rating 90; prefers boards that
 *   need lookahead.
 * Easy stays at n<=6 because hidden-singles-only layouts get
 * combinatorially rare past that size.
 */
export function difficultyParams(rating: SkillRating): GenerationParams {
  switch (tierForRating(rating)) {
    case 'easy':
      return { nRange: [5, 6], allowedTiers: ['easy'], styleWeights: STYLE_WEIGHTS };
    case 'medium':
      return { nRange: [6, 7], allowedTiers: ['medium'], styleWeights: STYLE_WEIGHTS };
    case 'hard':
      return { nRange: rating < 70 ? [7, 8] : [8, 9], allowedTiers: ['medium', 'hard'], styleWeights: STYLE_WEIGHTS };
    case 'expert':
      return {
        nRange: rating < 90 ? [10, 10] : [10, 11],
        allowedTiers: ['medium', 'hard'],
        preferHarderTier: true,
        styleWeights: STYLE_WEIGHTS,
      };
  }
}

/**
 * Attempt budget scales with the largest grid size in play: bigger boards
 * have a combinatorially smaller pool of valid unique/in-tier layouts, so a
 * flat budget starves them long before the small-board case even needs it
 * (see `difficultyParams` above -- n=9 medium needs ~14k attempts on
 * average, n<=6 needs well under 1k).
 */
export function maxAttemptsFor(params: GenerationParams): number {
  const nMax = params.nRange[1];
  if (nMax <= 6) return 4000;
  if (nMax === 7) return 6000;
  if (nMax === 8) return 10000;
  return 30000; // 9-11: the wall-clock deadline is the real cap here
}

/** Per-rung drop used by the generation fallback ladder (see
 * createLevelForIndexRobust) when the skill-matched board can't be found in
 * time. One step is tuned to move `difficultyParams` down roughly one grid
 * size (e.g. rating 100 -> 70 takes nMax from 9 to 8) rather than dropping
 * all the way to INITIAL_SKILL_RATING -- a player at the top of the range
 * timing out should land on a still-hard board, not a beginner one. Never
 * steps below the floor of the player's difficulty tier. */
const FALLBACK_STEP = 30;

export function stepDownRating(rating: SkillRating): SkillRating {
  return Math.max(MIN_RATING, tierFloor(rating), rating - FALLBACK_STEP);
}
