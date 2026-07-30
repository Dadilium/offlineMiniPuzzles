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
  /** Sampled per-attempt within this range -- see generator.ts. */
  minRectArea: [number, number];
  /** Bigger max area = more factorization ambiguity = harder. Sampled per-attempt. */
  maxRectArea: [number, number];
}

export type DifficultyTierKey = 'starter' | 'growing' | 'skilled' | 'expert';

interface Tier {
  key: DifficultyTierKey;
  minRating: number;
  sizeRange: [number, number];
  minRectArea: [number, number];
  maxRectArea: [number, number];
}

/**
 * Tuned against generation/__scripts__/sweep.ts -- do not hand-adjust these
 * without rerunning it. Board size stays square-ish and capped around 10x10
 * for solver speed; harder tiers grow both the board and the max leaf area
 * a clue can cover, since a bigger clue value has more factor pairs (more
 * candidate placements for the solver, and more visual ambiguity for the
 * player) than a small one.
 */
const TIERS: Tier[] = [
  { key: 'expert', minRating: 80, sizeRange: [9, 10], minRectArea: [2, 3], maxRectArea: [12, 16] },
  { key: 'skilled', minRating: 60, sizeRange: [8, 9], minRectArea: [2, 3], maxRectArea: [10, 13] },
  { key: 'growing', minRating: 40, sizeRange: [7, 8], minRectArea: [2, 3], maxRectArea: [8, 11] },
  { key: 'starter', minRating: 0, sizeRange: [5, 6], minRectArea: [2, 3], maxRectArea: [6, 9] },
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
    rowsRange: tier.sizeRange,
    colsRange: tier.sizeRange,
    minRectArea: tier.minRectArea,
    maxRectArea: tier.maxRectArea,
  };
}

/**
 * Attempt budget scales with board area -- uniqueness gets combinatorially
 * rarer as rows*cols grows and as the max leaf area (hence factor-pair
 * count) climbs. First guess, meant to be corrected by the checkpoint
 * sweep's measured attempts-to-success.
 */
export function maxAttemptsFor(area: number): number {
  if (area <= 36) return 4000;
  if (area <= 64) return 9000;
  if (area <= 81) return 16000;
  return 22000;
}
