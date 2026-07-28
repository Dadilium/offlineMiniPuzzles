/** 0-100, starts around the middle-low so early levels are gentle. */
export type SkillRating = number;

export const INITIAL_SKILL_RATING: SkillRating = 20;

const MIN_RATING = 0;
const MAX_RATING = 100;
/** Small per-level step so the curve moves gradually, never spikes. Same shape as Kings'/Matching Numbers' reducers. */
const STEP = 3;

export interface LevelResult {
  hintsUsed: number;
  skipped: boolean;
}

/**
 * Pure reducer, same shape as Kings'/Matching Numbers': no hints -> nudge up,
 * 2+ hints -> nudge down, exactly 1 hint -> "about right", a skip -> nudge
 * down harder (stronger "too much" signal than needing a hint).
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
  /** Minimum fraction of the box that must end up fillable (rest becomes obstacles) -- kept high so boards read as an open room with a few blockers, not a maze corridor. */
  minFillRatio: number;
  /** Backtrack budget for `growPath`'s constructive walk. */
  backtrackBudget: number;
}

/** Columns stay in a narrow band regardless of skill -- a fixed-feeling
 * width, portrait-shaped board (see rows below), not a bigger-in-every-
 * direction board. */
const COLS_FLOOR = 5;
const COLS_CEILING = 6;

/** Rows are what actually grows with skill -- a taller board reads as more
 * puzzle without needing a wider (harder-to-reach-across) one. */
const ROWS_FLOOR = 8;
const ROWS_CEILING = 14;

/** Boards are constructive/always-solvable (see generator.ts) rather than
 * uniqueness-verified -- a maze-tight fill ratio produced a single winding
 * corridor with no real choice in it, which read as broken rather than
 * puzzle-like. Kept high (and only mildly lower at high skill) so the board
 * stays open -- difficulty comes from board size, not obstacle density. */
const FILL_RATIO_EASY = 0.92;
const FILL_RATIO_HARD = 0.75;

/**
 * Pure mapping from a skill rating to generation params. First-cut curve,
 * meant to be tuned by feel once playable: board grows taller (not wider)
 * with rating, and gets mildly more obstacle-dense, but never maze-like.
 */
export function difficultyParams(rating: SkillRating): GenerationParams {
  const t = Math.max(0, Math.min(1, rating / MAX_RATING));

  const rows = ROWS_FLOOR + Math.round(t * (ROWS_CEILING - ROWS_FLOOR));
  const cols = COLS_FLOOR + Math.round(t * (COLS_CEILING - COLS_FLOOR));
  const minFillRatio = FILL_RATIO_EASY + t * (FILL_RATIO_HARD - FILL_RATIO_EASY);

  return {
    rowsRange: [Math.max(ROWS_FLOOR, rows - 1), rows],
    colsRange: [Math.max(COLS_FLOOR, cols - 1), cols],
    minFillRatio,
    backtrackBudget: 500 + rows * cols * 20,
  };
}

/**
 * Boards are guaranteed solvable by construction (see generator.ts) -- the
 * only reason to retry is the fingerprint de-dup check or `growPath` falling
 * short of `minFillRatio`, so a modest flat budget is plenty regardless of
 * size (same reasoning as Matching Numbers' `maxAttemptsFor`).
 */
export function maxAttemptsFor(): number {
  return 200;
}
