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
 * returns the next rating. Same shape as every other game's reducer here --
 * no hints used -> nudge up, two-plus hints or a skip -> nudge down (skip
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
  /** Fraction of cells that become trees, sampled per attempt. */
  treeDensity: [number, number];
}

export type DifficultyTierKey = 'starter' | 'growing' | 'skilled' | 'expert';

interface Tier {
  key: DifficultyTierKey;
  minRating: number;
  rowsRange: [number, number];
  colsRange: [number, number];
  treeDensity: [number, number];
}

/**
 * Tuned against generation/__scripts__/sweep.ts -- do not hand-adjust these
 * without rerunning it. Density stays well under 0.2 even at the top tier:
 * the no-touch constraint on tents caps how dense a solvable board can get
 * well before that, so pushing density higher just burns generator attempts
 * without making the puzzle meaningfully harder.
 *
 * Expert is rows > cols on purpose -- a taller board fills more of a phone
 * screen at the difficulty tier where players want the extra challenge to
 * feel physically bigger, not just denser.
 */
const TIERS: Tier[] = [
  { key: 'expert', minRating: 80, rowsRange: [11, 11], colsRange: [8, 8], treeDensity: [0.16, 0.2] },
  { key: 'skilled', minRating: 60, rowsRange: [7, 7], colsRange: [7, 7], treeDensity: [0.14, 0.18] },
  { key: 'growing', minRating: 40, rowsRange: [6, 6], colsRange: [6, 6], treeDensity: [0.12, 0.16] },
  { key: 'starter', minRating: 0, rowsRange: [5, 5], colsRange: [5, 5], treeDensity: [0.1, 0.14] },
];

function tierFor(rating: SkillRating): Tier {
  return TIERS.find((tier) => rating >= tier.minRating) ?? TIERS[TIERS.length - 1];
}

export function tierKeyFor(rating: SkillRating): DifficultyTierKey {
  return tierFor(rating).key;
}

export function difficultyParams(rating: SkillRating): GenerationParams {
  const tier = tierFor(rating);
  return {
    rowsRange: tier.rowsRange,
    colsRange: tier.colsRange,
    treeDensity: tier.treeDensity,
  };
}

/**
 * Attempt budget scales with board size -- uniqueness gets combinatorially
 * rarer as rows*cols grows, and the matching check adds cost per leaf on top
 * of Cross Sums' equivalent, so budgets start a notch above its sizes.
 * First guess, meant to be corrected by the checkpoint sweep's measured
 * attempts-to-success.
 */
export function maxAttemptsFor(params: GenerationParams): number {
  const sizeMax = Math.max(params.rowsRange[1], params.colsRange[1]);
  if (sizeMax <= 5) return 6000;
  if (sizeMax === 6) return 12000;
  if (sizeMax === 7) return 20000;
  return 30000;
}
