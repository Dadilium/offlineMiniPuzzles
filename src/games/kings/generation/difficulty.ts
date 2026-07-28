import type { RegionStyle } from './regionGrowth';

/** 0-100, starts around the middle-low so early levels are gentle. */
export type SkillRating = number;

export const INITIAL_SKILL_RATING: SkillRating = 20;

const MIN_RATING = 0;
const MAX_RATING = 100;
/** Small per-level step so the curve moves gradually, never spikes. */
const STEP = 3;

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
  /** Which tier of elimination-solver reasoning the level must require. */
  requiredTier: 'easy' | 'medium';
  styleWeights: Record<RegionStyle, number>;
}

/** Grid size floor/ceiling regardless of skill -- past this, difficulty
 * comes from reasoning tier/rounds/shape, not a bigger (harder-to-tap)
 * board. Existing hand-authored levels ran 5-7; 9 is reserved for rare
 * high-skill "big board" levels, not the norm. */
const N_FLOOR = 5;
const N_CEILING = 9;

/**
 * Pure mapping from a skill rating to generation parameters. First-cut curve,
 * meant to be tuned by feel once it's playable: grid size ramps gently from
 * 5 up to 8 across the rating range, with 9 reserved for the very top decile.
 *
 * The required reasoning tier is tied to grid size, not rating directly:
 * empirically, "easy" (hidden-singles-only) layouts get combinatorially rare
 * past n=6 (n=7 needs ~15k rejection-sampling attempts on average for one,
 * n=8-9 essentially never turn one up), while "medium" (needs locked
 * candidates) is comfortably findable at every size from 5 to 9. Requiring
 * "easy" at n>=7 would starve the search and silently fall back to a much
 * easier baseline level instead -- exactly what this is meant to avoid.
 */
export function difficultyParams(rating: SkillRating): GenerationParams {
  const t = Math.max(0, Math.min(1, rating / MAX_RATING));

  const nMax = t >= 0.9 ? N_CEILING : Math.min(N_CEILING - 1, N_FLOOR + Math.round(t * 3));
  const nMin = Math.max(N_FLOOR, nMax - 1);

  const requiredTier: 'easy' | 'medium' = nMax <= 6 ? 'easy' : 'medium';

  return {
    nRange: [nMin, nMax],
    requiredTier,
    styleWeights: { uniform: 0.55, directional: 0.45 },
  };
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
  return 30000;
}
