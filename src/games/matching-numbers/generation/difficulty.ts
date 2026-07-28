import type { BoardBuildParams } from './boardBuilder';

// 0-100, starts around the middle-low so early levels are gentle.
export type SkillRating = number;
export const INITIAL_SKILL_RATING: SkillRating = 20;

const MIN_RATING = 0;
const MAX_RATING = 100;
const STEP = 3;

export interface LevelResult {
  hintsUsed: number;
  /** Genre-standard assist, not a cheat -- weighted the same as a hint, not harsher. */
  addNumbersUsed: number;
  skipped: boolean;
}

/**
 * Pure reducer, same shape/step-size as Kings'. Hints and Add-Numbers uses
 * are folded into one combined "needed help" count rather than two separate
 * thresholds -- both represent the same underlying "player got stuck" signal.
 */
export function nextSkillRating(prev: SkillRating, result: LevelResult): SkillRating {
  let delta = 0;
  const struggleSignals = result.hintsUsed + result.addNumbersUsed;
  if (result.skipped) delta = -STEP * 2;
  else if (struggleSignals >= 2) delta = -STEP;
  else if (struggleSignals === 0) delta = STEP;
  // struggleSignals === 1 -> "about right", no change.

  return Math.max(MIN_RATING, Math.min(MAX_RATING, prev + delta));
}

export interface GenerationParams {
  rowsRange: [number, number];
  colsRange: [number, number];
  /** Weight of 'equal' vs 'sum10' when building the pair plan (sum10 weight = 1 - equalWeight). */
  equalWeight: number;
  boardParams: BoardBuildParams;
}

const ROWS_FLOOR = 4;
const ROWS_CEILING = 8;
const COLS_FLOOR = 6;
const COLS_CEILING = 10;

/**
 * First-cut curve, tune by feel once playable. Board grows gently with
 * rating; equalWeight drifts down (more sum10 pairs, which need a small
 * arithmetic step the trivial equal-match doesn't); bendBias climbs (more
 * single-bend connections required instead of free straight lines).
 */
export function difficultyParams(rating: SkillRating): GenerationParams {
  const t = Math.max(0, Math.min(1, rating / MAX_RATING));

  const rows = ROWS_FLOOR + Math.round(t * (ROWS_CEILING - ROWS_FLOOR));
  const cols = COLS_FLOOR + Math.round(t * (COLS_CEILING - COLS_FLOOR));

  const equalWeight = 0.75 - 0.35 * t; // 0.75 -> 0.40
  const bendBias = 0.1 + 0.6 * t; // 0.1 -> 0.7
  // Absolute count, independent of board size, of pairs the generator tries
  // to make non-adjacent (spread across the board) -- kept small so the
  // search for them stays fast no matter how big the board itself gets.
  // Most pairs stay plain adjacent dominoes even at max difficulty;
  // difficulty comes from a growing (but still small) pool of pairs that
  // require an actual search for their partner, not from that pool becoming
  // the majority of the board.
  const complexPairTarget = Math.round(2 + t * 10); // 2 -> 12

  return {
    rowsRange: [Math.max(ROWS_FLOOR, rows - 1), rows],
    colsRange: [Math.max(COLS_FLOOR, cols - 1), cols],
    equalWeight,
    boardParams: { complexPairTarget, bendBias, candidatePoolCap: 40, backtrackBudget: 4000 },
  };
}

/**
 * buildBoard can't structurally fail (see boardBuilder.ts), so this is just
 * a small safety margin against the fingerprint de-dup loop in generator.ts.
 */
export function maxAttemptsFor(): number {
  return 10;
}
