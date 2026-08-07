import type { BoardBuildParams } from './boardBuilder';

// 0-100, starts around the middle-low so early levels are gentle.
export type SkillRating = number;
export const INITIAL_SKILL_RATING: SkillRating = 20;

const MIN_RATING = 0;
const MAX_RATING = 100;
const STEP = 3;

/** Fixed board width -- the board is always full-width with this many
 * columns, at every difficulty. Only row count (and thus total tile count)
 * scales with skill rating; see GameScreen/MatchingNumbersGrid for how the
 * remaining screen height is padded out with placeholder cells when a level
 * doesn't need every row. */
export const BOARD_COLS = 10;

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

// Bumped up across the board (even at the floor) -- with most pairs now
// scattered rather than sitting in obvious adjacent dominoes (see
// poolFraction below), the board needs more room for those non-adjacent/bent
// connections to actually fit.
const ROWS_FLOOR = 4;
const ROWS_CEILING = 10;

/**
 * First-cut curve, tune by feel once playable. Board grows gently with
 * rating; equalWeight drifts down (more sum10 pairs, which need a small
 * arithmetic step the trivial equal-match doesn't); bendBias climbs (more
 * single-bend connections required instead of free straight lines).
 */
export function difficultyParams(rating: SkillRating): GenerationParams {
  const t = Math.max(0, Math.min(1, rating / MAX_RATING));

  const rows = ROWS_FLOOR + Math.round(t * (ROWS_CEILING - ROWS_FLOOR));
  const m = (rows * BOARD_COLS) / 2;

  const equalWeight = 0.75 - 0.35 * t; // 0.75 -> 0.40
  const bendBias = 0.1 + 0.6 * t; // 0.1 -> 0.7
  // Fraction of the board's pairs to scatter (non-adjacent), rather than a
  // small flat count -- most of the board should require real searching, not
  // just a handful of cells sitting apart from an otherwise-trivial grid of
  // adjacent dominoes. buildBoard realizes this in independent small rounds
  // rather than one atomic ask (see POOL_BATCH_SIZE there), so a high
  // fraction here is realistic, not just aspirational.
  const poolFraction = 0.4 + 0.5 * t; // 0.4 -> 0.9
  const complexPairTarget = Math.round(m * poolFraction);

  return {
    rowsRange: [Math.max(ROWS_FLOOR, rows - 1), rows],
    colsRange: [BOARD_COLS, BOARD_COLS],
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
