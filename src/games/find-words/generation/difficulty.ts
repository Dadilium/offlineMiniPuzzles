import type { Direction } from '../types';

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
 * a skip nudges down harder, 2+ hints nudges down, a hint-free solve nudges
 * up, and 1 hint holds steady.
 */
export function nextSkillRating(prev: SkillRating, result: LevelResult): SkillRating {
  let delta = 0;
  if (result.skipped) delta = -STEP * 2;
  else if (result.hintsUsed >= 2) delta = -STEP;
  else if (result.hintsUsed === 0) delta = STEP;

  return Math.max(MIN_RATING, Math.min(MAX_RATING, prev + delta));
}

export interface GenerationParams {
  /** Rows and cols are sampled independently within this same range, keeping the board roughly square. */
  sizeRange: [number, number];
  wordCount: number;
  wordLengthRange: [number, number];
  /** Which of the 6 storage directions this tier may place words in -- see Direction's comment in types.ts. */
  directions: Direction[];
}

export type DifficultyTierKey = 'starter' | 'growing' | 'skilled' | 'expert';

interface Tier {
  key: DifficultyTierKey;
  minRating: number;
  sizeRange: [number, number];
  wordCount: number;
  wordLengthRange: [number, number];
  directions: Direction[];
}

/** Reading-order only: a word placed this way spells out correctly when scanned left-to-right/top-to-bottom, the easiest to spot by eye. */
const READING_DIRECTIONS: Direction[] = ['E', 'S', 'SE'];
/** Adds the exact reverse of each reading direction -- the word is still there, but reads backwards when scanned normally. */
const ALL_DIRECTIONS: Direction[] = ['E', 'W', 'N', 'S', 'SE', 'NW'];

/**
 * Tuned against generation/__scripts__/sweep.ts -- do not hand-adjust these
 * without rerunning it. Board grows and packs in more/longer words as rating
 * climbs; direction set only widens at `skilled` and above, per the
 * approved plan's "reading-only at low difficulty" rule.
 */
const TIERS: Tier[] = [
  { key: 'expert', minRating: 80, sizeRange: [12, 13], wordCount: 11, wordLengthRange: [5, 8], directions: ALL_DIRECTIONS },
  { key: 'skilled', minRating: 60, sizeRange: [10, 11], wordCount: 9, wordLengthRange: [4, 7], directions: ALL_DIRECTIONS },
  { key: 'growing', minRating: 40, sizeRange: [9, 10], wordCount: 7, wordLengthRange: [4, 6], directions: READING_DIRECTIONS },
  { key: 'starter', minRating: 0, sizeRange: [7, 8], wordCount: 5, wordLengthRange: [3, 5], directions: READING_DIRECTIONS },
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
    sizeRange: tier.sizeRange,
    wordCount: tier.wordCount,
    wordLengthRange: tier.wordLengthRange,
    directions: tier.directions,
  };
}

/**
 * Attempt budget for a full grid (word subset + placement of every word) --
 * word placement is far cheaper than Shikaku's uniqueness-certified
 * subdivision, so this stays modest even at the largest board size.
 */
export function maxGridAttemptsFor(area: number): number {
  if (area <= 64) return 150;
  if (area <= 100) return 250;
  return 400;
}

/** Attempt budget for placing one single word within one grid attempt. */
export const PLACEMENT_ATTEMPTS_PER_WORD = 200;
