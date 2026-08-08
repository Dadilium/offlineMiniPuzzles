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
 * doesn't need every row. Odd on purpose (bigger cells than 10 cols) --
 * since it's odd, `rows` below is kept even (rows*cols must stay even for
 * every cell to have a partner -- see boardBuilder.ts's pickDims). */
export const BOARD_COLS = 9;

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
const ROWS_CEILING = 10;

// Flat across every difficulty, not scaled by rating -- a "headstart" is
// about the board never opening on a dead end, not a difficulty lever in
// itself. Board size and equalWeight are what carry the difficulty curve now
// that positions are a genuine random shuffle (see boardBuilder.ts) rather
// than a constructed layout.
const MIN_HEADSTART_MOVES = 5;
// hasHeadstart's simulation is cheap (a handful of engine.findLegalMove
// scans), so this can afford to be generous -- worth many reshuffles to find
// one that clears the headstart bar before ever falling back to whatever the
// last attempt happened to produce.
const RESHUFFLE_ATTEMPTS = 40;

/**
 * Board grows gently with rating (more cells to scan, longer to fully
 * clear); equalWeight drifts down so sum10 pairs (which need an actual
 * d+(10-d) check) dominate over identical-digit pairs (an instant visual
 * pop-out, no arithmetic needed) at higher skill.
 */
export function difficultyParams(rating: SkillRating): GenerationParams {
  const t = Math.max(0, Math.min(1, rating / MAX_RATING));

  // Rounded to even -- BOARD_COLS is odd, so rows must stay even (see comment above).
  const rows = Math.round((ROWS_FLOOR + t * (ROWS_CEILING - ROWS_FLOOR)) / 2) * 2;

  const equalWeight = 0.6 - 0.45 * t; // 0.6 -> 0.15

  return {
    rowsRange: [Math.max(ROWS_FLOOR, rows - 2), rows],
    colsRange: [BOARD_COLS, BOARD_COLS],
    equalWeight,
    boardParams: { minHeadstartMoves: MIN_HEADSTART_MOVES, maxAttempts: RESHUFFLE_ATTEMPTS },
  };
}

/**
 * buildBoard can't structurally fail (see boardBuilder.ts), so this is just
 * a small safety margin against the fingerprint de-dup loop in generator.ts.
 */
export function maxAttemptsFor(): number {
  return 10;
}
