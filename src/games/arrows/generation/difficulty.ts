import { DIFFICULTY_TIERS, TIER_BANDS, tierForRating, type DifficultyTier } from '../../../state/difficultyTiers';

/** 0-150: the standard 0-100 scale plus the Infernal band above it. Starts
 * at the bottom of Medium like the other games here. */
export type SkillRating = number;

export const INITIAL_SKILL_RATING: SkillRating = 40;

/** Every tier, Infernal included -- Arrows is the one game that offers it. */
export const ARROWS_TIERS: readonly DifficultyTier[] = DIFFICULTY_TIERS;

const MIN_RATING = 0;
const MAX_RATING = TIER_BANDS.infernal[1];
/** Small per-level step so the curve moves gradually, never spikes. */
const STEP = 3;

export interface LevelResult {
  hintsUsed: number;
  skipped: boolean;
  /** Hearts lost on the run that actually cleared the board, plus 3 for
   * every run that ran out of hearts first. */
  livesLost?: number;
}

/** Hearts lost on a level from which the clear counts as a struggle -- i.e.
 * the player ran out at least once. */
const STRUGGLE_LIVES_LOST = 3;

/**
 * Pure reducer, same shape as every other game's: a clean clear (no hints,
 * at most one bump) nudges up; a skip, two-plus hints, or a struggle (ran
 * out of hearts at least once) nudges down; anything in between -- e.g. a
 * clear on the last heart -- holds.
 */
export function nextSkillRating(prev: SkillRating, result: LevelResult): SkillRating {
  const livesLost = result.livesLost ?? 0;
  let delta = 0;
  if (result.skipped) delta = -STEP * 2;
  else if (result.hintsUsed >= 2 || livesLost >= STRUGGLE_LIVES_LOST) delta = -STEP;
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
    // ~1.5x Expert's cells (and so arrows) at its floor, ~2x at the cap.
    tier: 'infernal',
    minRating: TIER_BANDS.infernal[0],
    rowsRange: [48, 52],
    colsRange: [32, 34],
    lengthRange: [6, 22],
    maxStretch: 30,
    turnChance: 0.52,
    rayBias: 1.7,
    minRounds: 16,
    maxFreeRatio: 0.14,
  },
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

const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;

const lerpInt = (from: number, to: number, t: number): number => Math.round(lerp(from, to, t));

const lerpRange = (from: [number, number], to: [number, number], t: number): [number, number] => [
  lerpInt(from[0], to[0], t),
  lerpInt(from[1], to[1], t),
];

/** Where Infernal's params land at the very top of the scale -- the target
 * its band eases toward, since there's no harder tier's floor above it. */
const CAP: Tier = {
  tier: 'infernal',
  minRating: MAX_RATING,
  rowsRange: [54, 58],
  colsRange: [36, 38],
  lengthRange: [7, 24],
  maxStretch: 34,
  turnChance: 0.55,
  rayBias: 1.9,
  minRounds: 20,
  // Boards this big rarely come in under 12% free openers; a tighter gate
  // only buys rejected attempts. Size is capped here for the same reason:
  // generation cost (and the odds of an unfillable hole) climbs steeply
  // with area -- rerun sweep.ts before growing it.
  maxFreeRatio: 0.12,
};

/**
 * Each tier's row above is its floor: params ease linearly from it toward
 * the next tier's floor (Infernal: toward `CAP`) as the rating climbs the
 * band, so every +3 grows the board a little instead of everything jumping
 * at the tier line.
 */
export function difficultyParams(rating: SkillRating): GenerationParams {
  const key = tierForRating(rating);
  const index = Math.max(0, TIERS.findIndex((tier) => tier.tier === key));
  const { minRating, ...from } = TIERS[index];
  const next = TIERS[index - 1] ?? CAP;
  if (next.minRating <= minRating) return from;

  const t = Math.max(0, Math.min(1, (rating - minRating) / (next.minRating - minRating)));
  return {
    tier: from.tier,
    rowsRange: lerpRange(from.rowsRange, next.rowsRange, t),
    colsRange: lerpRange(from.colsRange, next.colsRange, t),
    lengthRange: lerpRange(from.lengthRange, next.lengthRange, t),
    maxStretch: lerpInt(from.maxStretch, next.maxStretch, t),
    turnChance: lerp(from.turnChance, next.turnChance, t),
    rayBias: lerp(from.rayBias, next.rayBias, t),
    minRounds: lerpInt(from.minRounds, next.minRounds, t),
    maxFreeRatio: lerp(from.maxFreeRatio, next.maxFreeRatio, t),
  };
}

/** Construction never fails outright -- attempts only buy a board that also
 * clears the tier's gates, so a modest fixed budget is plenty. */
export const MAX_ATTEMPTS = 40;
