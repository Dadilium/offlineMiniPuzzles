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
 * returns the next rating. Same shape as Kings/Block Fill's reducer -- no
 * hints used -> nudge up, two-plus hints or a skip -> nudge down (skip
 * harder), exactly one hint -> leave it alone.
 */
export function nextSkillRating(prev: SkillRating, result: LevelResult): SkillRating {
  let delta = 0;
  if (result.skipped) delta = -STEP * 2;
  else if (result.hintsUsed >= 2) delta = -STEP;
  else if (result.hintsUsed === 0) delta = STEP;

  return Math.max(MIN_RATING, Math.min(MAX_RATING, prev + delta));
}

export interface GenerationParams {
  rowsRange: [number, number];
  colsRange: [number, number];
  /** Fraction of cells kept in the generated mask, sampled per attempt. */
  keepDensity: [number, number];
}

/**
 * Size curve tuned after the checkpoint sweep: steps up by one every 20
 * rating points, capping at a flat 8x8 (no size variety left) at the top
 * tier -- uniqueness held up fine even at 8 cells, so there's no need to
 * hold anything back there.
 */
const SIZE_TIERS: Array<{ minRating: number; range: [number, number] }> = [
  { minRating: 80, range: [7, 8] },
  { minRating: 60, range: [6, 7] },
  { minRating: 40, range: [5, 6] },
  { minRating: 0, range: [4, 5] },
];

export function difficultyParams(rating: SkillRating): GenerationParams {
  const sizeRange: [number, number] =
    rating >= MAX_RATING ? [8, 8] : SIZE_TIERS.find((tier) => rating >= tier.minRating)!.range;

  return {
    rowsRange: sizeRange,
    colsRange: sizeRange,
    keepDensity: [0.45, 0.55],
  };
}

/**
 * Attempt budget scales with board size -- uniqueness gets combinatorially
 * rarer as rows*cols grows, same reasoning as Kings' maxAttemptsFor. First
 * guess, meant to be corrected by the checkpoint sweep's measured
 * attempts-to-success.
 */
export function maxAttemptsFor(params: GenerationParams): number {
  const sizeMax = Math.max(params.rowsRange[1], params.colsRange[1]);
  if (sizeMax <= 5) return 4000;
  if (sizeMax === 6) return 8000;
  return 15000;
}
