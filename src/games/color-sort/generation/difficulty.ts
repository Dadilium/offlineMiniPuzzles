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
  colorsRange: [number, number];
  capacity: number;
  extraEmptyRange: [number, number];
  /** The actual difficulty proxy -- a generated board must solve in at least this many moves, or it's rejected as too easy for the tier. */
  minSolutionMoves: number;
  /** BFS state cap for the generator's certifying solve -- must stay ahead of what a genuine board at this tier needs, or good boards get wrongly rejected as truncated. */
  solverStateBudget: number;
}

export type DifficultyTierKey = 'starter' | 'growing' | 'skilled' | 'expert';

const CAPACITY = 4;

interface Tier {
  key: DifficultyTierKey;
  minRating: number;
  colorsRange: [number, number];
  extraEmptyRange: [number, number];
  minSolutionMoves: number;
  solverStateBudget: number;
}

/**
 * Tuned against generation/__scripts__/sweep.ts -- do not hand-adjust these
 * without rerunning it. `extraEmptyRange` never drops to 0 (a board with no
 * spare tube at all is a much sharper difficulty cliff than colors/moves
 * alone would suggest).
 */
const TIERS: Tier[] = [
  { key: 'expert', minRating: 80, colorsRange: [9, 11], extraEmptyRange: [1, 1], minSolutionMoves: 28, solverStateBudget: 500_000 },
  { key: 'skilled', minRating: 60, colorsRange: [7, 8], extraEmptyRange: [1, 2], minSolutionMoves: 18, solverStateBudget: 200_000 },
  { key: 'growing', minRating: 40, colorsRange: [6, 6], extraEmptyRange: [2, 2], minSolutionMoves: 11, solverStateBudget: 80_000 },
  { key: 'starter', minRating: 0, colorsRange: [4, 5], extraEmptyRange: [2, 2], minSolutionMoves: 6, solverStateBudget: 30_000 },
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
    colorsRange: tier.colorsRange,
    capacity: CAPACITY,
    extraEmptyRange: tier.extraEmptyRange,
    minSolutionMoves: tier.minSolutionMoves,
    solverStateBudget: tier.solverStateBudget,
  };
}

/**
 * Attempt budget scales with tier -- a long-enough solution gets rarer as
 * colors/tubes grow, same reasoning as every other game's maxAttemptsFor.
 * First guess, meant to be corrected by the checkpoint sweep's measured
 * attempts-to-success.
 */
export function maxAttemptsFor(params: GenerationParams): number {
  const colorsMax = params.colorsRange[1];
  if (colorsMax <= 5) return 3000;
  if (colorsMax <= 6) return 6000;
  if (colorsMax <= 8) return 12000;
  return 20000;
}
