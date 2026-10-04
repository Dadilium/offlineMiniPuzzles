import { tierForRating, type DifficultyTier } from '../../../state/difficultyTiers';

/** 0-100, starts at the bottom of Medium like the other games here. */
export type SkillRating = number;

export const INITIAL_SKILL_RATING: SkillRating = 40;

const MIN_RATING = 0;
const MAX_RATING = 100;
/** Small per-level step so the curve moves gradually, never spikes. */
const STEP = 3;

export interface LevelResult {
  hintsUsed: number;
  skipped: boolean;
  /** Hearts lost on the run that actually cleared the board, plus 3 for
   * every run that ran out of hearts first. */
  livesLost?: number;
}

/**
 * Pure reducer, same shape as every other game's: a clean clear (no hints,
 * at most one bump) nudges up; a skip, two-plus hints, or a struggle (two
 * or more hearts lost overall) nudges down; anything in between holds.
 */
export function nextSkillRating(prev: SkillRating, result: LevelResult): SkillRating {
  const livesLost = result.livesLost ?? 0;
  let delta = 0;
  if (result.skipped) delta = -STEP * 2;
  else if (result.hintsUsed >= 2 || livesLost >= 2) delta = -STEP;
  else if (result.hintsUsed === 0 && livesLost <= 1) delta = STEP;

  return Math.max(MIN_RATING, Math.min(MAX_RATING, prev + delta));
}

export interface GenerationParams {
  tier: DifficultyTier;
  rowsRange: [number, number];
  colsRange: [number, number];
  /** Body length (cells) a freshly placed arrow grows toward. */
  lengthRange: [number, number];
  /** Tails may stretch up to this while the main pass runs; the final
   * gap-filling pass lifts the cap, since no cell may stay empty. */
  maxStretch: number;
  /** Chance the body turns at each step -- higher = more winding arrows. */
  turnChance: number;
  /** Head placement weight is `(rayLength + 1) ^ rayBias`: positive values
   * favor heads aimed across many arrows (deep chains) over heads on the
   * edge pointing out (free openers). */
  rayBias: number;
  /** Generation gates (see generator.ts). Every board is also 100% full. */
  minRounds: number;
  maxFreeRatio: number;
}

interface Tier extends GenerationParams {
  minRating: number;
}

/**
 * Tuned against generation/__scripts__/sweep.ts -- rerun it before
 * hand-adjusting. Boards stay portrait (rows > cols) to match the phone's
 * board area, and get big quickly: cells shrink so lines read as a fine
 * mesh, as in the reference game, and pinch-zoom is part of play from Hard
 * up.
 */
const TIERS: Tier[] = [
  {
    tier: 'expert',
    minRating: 80,
    rowsRange: [38, 42],
    colsRange: [26, 28],
    lengthRange: [6, 20],
    maxStretch: 28,
    turnChance: 0.5,
    rayBias: 1.6,
    minRounds: 14,
    maxFreeRatio: 0.16,
  },
  {
    tier: 'hard',
    minRating: 60,
    rowsRange: [27, 30],
    colsRange: [19, 21],
    lengthRange: [5, 14],
    maxStretch: 20,
    turnChance: 0.45,
    rayBias: 1.3,
    minRounds: 11,
    maxFreeRatio: 0.22,
  },
  {
    tier: 'medium',
    minRating: 40,
    rowsRange: [19, 22],
    colsRange: [13, 15],
    lengthRange: [4, 10],
    maxStretch: 14,
    turnChance: 0.4,
    rayBias: 1,
    minRounds: 7,
    maxFreeRatio: 0.28,
  },
  {
    tier: 'easy',
    minRating: 0,
    rowsRange: [13, 15],
    colsRange: [9, 10],
    lengthRange: [3, 7],
    maxStretch: 10,
    turnChance: 0.35,
    rayBias: 0.6,
    minRounds: 5,
    maxFreeRatio: 0.42,
  },
];

function tierFor(rating: SkillRating): Tier {
  const key = tierForRating(rating);
  return TIERS.find((tier) => tier.tier === key) ?? TIERS[TIERS.length - 1];
}

export function difficultyParams(rating: SkillRating): GenerationParams {
  const { minRating: _minRating, ...params } = tierFor(rating);
  return params;
}

/** Construction never fails outright -- attempts only buy a board that also
 * clears the tier's gates, so a modest fixed budget is plenty. */
export const MAX_ATTEMPTS = 40;
