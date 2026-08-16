import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { createProgressStore } from '../../../state/createProgressStore';
import { applyAddNumbers, applyMatch, findLegalMove, MAX_ADD_NUMBERS, removeRows } from '../engine';
import { createLevelForIndexRobust, fingerprintGrid, INITIAL_SKILL_RATING, nextSkillRating, type SkillRating } from '../generation';
import type { Cell, GridValue, MatchingNumbersLevel } from '../types';

// v2: internal shape changed when progress moved onto the shared
// createProgressStore -- old entries just get a clean slate (see that
// file's storageKey doc).
const STORAGE_KEY = '@signal-arcade/matching-numbers/progress/v2';

interface MatchingNumbersCustom {
  /** The CURRENT live board (post-taps, post-Add-Numbers) -- separate from
   * generatedLevels[idx].grid (the pristine initial board) so progress can
   * resume mid-solve. Row count here can exceed the level's original `rows`
   * once Add Numbers has been used. */
  boardsByLevel: Record<number, GridValue[][]>;
  addNumbersUsedByLevel: Record<number, number>;
}

function isValidLevel(level: unknown): level is MatchingNumbersLevel {
  const l = level as MatchingNumbersLevel | null;
  return !!l && typeof l.rows === 'number' && typeof l.cols === 'number' && Array.isArray(l.grid);
}

function cloneGrid(grid: GridValue[][]): GridValue[][] {
  return grid.map((row) => row.slice());
}

/** Guards against a corrupt/stale board shape -- falls back to the level's own pristine grid. */
function sanitizeBoard(board: unknown, level: MatchingNumbersLevel): GridValue[][] {
  if (!Array.isArray(board) || board.length < level.rows) return cloneGrid(level.grid);
  for (const row of board) {
    if (!Array.isArray(row) || row.length !== level.cols) return cloneGrid(level.grid);
  }
  // A fully-empty row should never survive to a persisted save -- the
  // collapse effect always removes one within ROW_COLLAPSE_MS of it
  // appearing. One showing up here means a prior session's save landed
  // mid-collapse (or hit the row-index race this hardens elsewhere) --
  // self-heal by dropping it now instead of rendering it as a dead/blank
  // row forever. Skipped if it would empty the board entirely (a genuine
  // full clear) -- that state is handled by the level-restart effect, not here.
  const withoutEmptyRows = (board as GridValue[][]).filter((row) => row.some((v) => v !== null));
  return withoutEmptyRows.length > 0 ? withoutEmptyRows : (board as GridValue[][]);
}

const store = createProgressStore<MatchingNumbersLevel, MatchingNumbersCustom>({
  storageKey: STORAGE_KEY,
  initialSkillRating: INITIAL_SKILL_RATING,
  nextSkillRating: (prev, input) =>
    nextSkillRating(prev as SkillRating, input as { hintsUsed: number; addNumbersUsed: number; skipped: boolean }),
  // On skip, Add Numbers usage never counts against the rating -- the skip
  // itself already penalizes harder (see nextSkillRating), same as every
  // other game's hintsUsed staying 0 on skip.
  extraSkillInputs: (levelIndex, state, phase) => ({
    addNumbersUsed: phase === 'complete' ? (state.custom.addNumbersUsedByLevel[levelIndex] ?? 0) : 0,
  }),
  isValidLevel,
  generate: (levelIndex, skillRating, recentFingerprints) =>
    createLevelForIndexRobust(levelIndex, skillRating as SkillRating, recentFingerprints),
  fingerprint: (level) => fingerprintGrid(level.grid),
  defaultCustom: () => ({ boardsByLevel: {}, addNumbersUsedByLevel: {} }),
  sanitizeCustom: (raw, generatedLevels) => {
    const parsed = (raw ?? {}) as Partial<MatchingNumbersCustom>;
    const rawBoards = (parsed.boardsByLevel ?? {}) as Record<string, unknown>;
    const rawAddNumbers = (parsed.addNumbersUsedByLevel ?? {}) as Record<string, unknown>;
    const boardsByLevel: Record<number, GridValue[][]> = {};
    const addNumbersUsedByLevel: Record<number, number> = {};
    for (const [key, level] of Object.entries(generatedLevels)) {
      const idx = Number(key);
      boardsByLevel[idx] = sanitizeBoard(rawBoards[key], level);
      addNumbersUsedByLevel[idx] = typeof rawAddNumbers[key] === 'number' ? (rawAddNumbers[key] as number) : 0;
    }
    return { boardsByLevel, addNumbersUsedByLevel };
  },
  onLevelGenerated: (custom, level, levelIndex) => ({
    boardsByLevel: { ...custom.boardsByLevel, [levelIndex]: cloneGrid(level.grid) },
    addNumbersUsedByLevel: { ...custom.addNumbersUsedByLevel, [levelIndex]: 0 },
  }),
  resetLevelCustom: (custom, level, levelIndex) => ({
    boardsByLevel: { ...custom.boardsByLevel, [levelIndex]: cloneGrid(level.grid) },
    addNumbersUsedByLevel: { ...custom.addNumbersUsedByLevel, [levelIndex]: 0 },
  }),
});

interface MatchingNumbersProgressContextValue {
  ready: boolean;
  /** Pure lookup -- undefined until `ensureLevel` has generated this index. */
  levelFor: (levelIndex: number) => MatchingNumbersLevel | undefined;
  /** Generates (and persists) a level for this index if missing. Safe to call
   * speculatively ahead of need (e.g. to prefetch the next level) since it's
   * a no-op once a level has already been generated for that index. */
  ensureLevel: (levelIndex: number) => void;
  boardsByLevel: Record<number, GridValue[][]>;
  levelsCompleted: Set<number>;
  levelsSkipped: Set<number>;
  tutorialsSeen: Set<string>;
  skillRating: SkillRating;
  addNumbersUsedByLevel: Record<number, number>;
  /** Assumes the caller already validated legality via engine.attemptMatch (e.g. to drive a success/fail animation) -- unconditionally clears both cells. */
  commitMatch: (levelIndex: number, a: Cell, b: Cell) => void;
  /** Removes a set of rows once their shared shift-up collapse animation has finished -- see engine.findFullyEmptyRows. */
  collapseRows: (levelIndex: number, rowIndices: number[]) => void;
  /** Spends an Add Numbers charge if any remain. Returns false (no-op) once MAX_ADD_NUMBERS has been used this level. */
  addNumbers: (levelIndex: number) => boolean;
  /** Live scan of the current board for any currently-legal pair (see engine.ts). Returns null if the board is stuck. */
  giveHint: (levelIndex: number) => [Cell, Cell] | null;
  /** Restores the level's pristine board and resets its Add Numbers charges. */
  resetLevel: (levelIndex: number) => void;
  markLevelComplete: (levelIndex: number) => void;
  markLevelSkipped: (levelIndex: number) => void;
  markTutorialSeen: (key: string) => void;
  /** Wipes all generated levels, boards, and completion/skip/tutorial state -- for the Settings > Game Progress reset. */
  resetAllProgress: () => void;
}

export const MatchingNumbersProgressProvider = store.Provider;

export function useMatchingNumbersProgress(): MatchingNumbersProgressContextValue {
  const s = store.useProgress();
  const { getCurrent, commit } = s;

  const commitMatch = useCallback(
    (levelIndex: number, a: Cell, b: Cell) => {
      const current = getCurrent();
      const board = current.custom.boardsByLevel[levelIndex];
      if (!board) return;
      const nextBoard = applyMatch(board, a, b);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      commit({ ...current, custom: { ...current.custom, boardsByLevel: { ...current.custom.boardsByLevel, [levelIndex]: nextBoard } } });
    },
    [getCurrent, commit]
  );

  /**
   * Called once a set of fully-cleared rows' shared shift-up animation has
   * finished playing -- see engine.findFullyEmptyRows. `rowIndices` was
   * computed by the caller up to ROW_COLLAPSE_MS ago; re-checked against the
   * CURRENT board here rather than trusted blindly, so a row that picked up
   * new content in between (or was never truly empty due to some other race)
   * never gets deleted along with whatever numbers are sitting in it.
   */
  const collapseRows = useCallback(
    (levelIndex: number, rowIndices: number[]) => {
      const current = getCurrent();
      const board = current.custom.boardsByLevel[levelIndex];
      if (!board) return;
      const stillEmpty = rowIndices.filter((r) => board[r]?.every((v) => v === null));
      if (stillEmpty.length === 0) return;
      const nextBoard = removeRows(board, stillEmpty);
      commit({ ...current, custom: { ...current.custom, boardsByLevel: { ...current.custom.boardsByLevel, [levelIndex]: nextBoard } } });
    },
    [getCurrent, commit]
  );

  const addNumbers = useCallback(
    (levelIndex: number): boolean => {
      const current = getCurrent();
      const board = current.custom.boardsByLevel[levelIndex];
      if (!board) return false;
      const used = current.custom.addNumbersUsedByLevel[levelIndex] ?? 0;
      if (used >= MAX_ADD_NUMBERS) return false;

      const nextBoard = applyAddNumbers(board);
      commit({
        ...current,
        custom: {
          boardsByLevel: { ...current.custom.boardsByLevel, [levelIndex]: nextBoard },
          addNumbersUsedByLevel: { ...current.custom.addNumbersUsedByLevel, [levelIndex]: used + 1 },
        },
      });
      return true;
    },
    [getCurrent, commit]
  );

  /** Always a live scan of the current board (see engine.findLegalMove) -- can genuinely return null once the player exhausts what the random layout happened to offer. */
  const giveHint = useCallback(
    (levelIndex: number): [Cell, Cell] | null => {
      const current = getCurrent();
      const board = current.custom.boardsByLevel[levelIndex];
      if (!board) return null;
      const move = findLegalMove(board);
      if (!move) return null;

      commit({ ...current, hintsUsedByLevel: { ...current.hintsUsedByLevel, [levelIndex]: (current.hintsUsedByLevel[levelIndex] ?? 0) + 1 } });
      return move;
    },
    [getCurrent, commit]
  );

  return {
    ready: s.ready,
    levelFor: s.levelFor,
    ensureLevel: s.ensureLevel,
    boardsByLevel: s.custom.boardsByLevel,
    levelsCompleted: s.levelsCompleted,
    levelsSkipped: s.levelsSkipped,
    tutorialsSeen: s.tutorialsSeen,
    skillRating: s.skillRating as SkillRating,
    addNumbersUsedByLevel: s.custom.addNumbersUsedByLevel,
    commitMatch,
    collapseRows,
    addNumbers,
    giveHint,
    resetLevel: s.resetLevel,
    markLevelComplete: s.markLevelComplete,
    markLevelSkipped: s.markLevelSkipped,
    markTutorialSeen: s.markTutorialSeen,
    resetAllProgress: s.resetAllProgress,
  };
}
