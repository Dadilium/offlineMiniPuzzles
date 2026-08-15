import { useCallback } from 'react';
import { createProgressStore } from '../../../state/createProgressStore';
import { applyHint, cycleCellState, makeEmptyBoard } from '../engine';
import {
  BACKGROUND_DEADLINES,
  createLevelForIndexRobust,
  fingerprintRegions,
  INITIAL_SKILL_RATING,
  nextSkillRating,
  URGENT_DEADLINES,
  type SkillRating,
} from '../generation';
import type { CellState, KingsLevel } from '../types';

// v3: internal shape changed when progress moved onto the shared
// createProgressStore -- old entries just get a clean slate (see that
// file's storageKey doc).
const STORAGE_KEY = '@signal-arcade/kings/progress/v3';

interface KingsCustom {
  boardsByLevel: Record<number, CellState[][]>;
}

function isValidLevel(level: unknown): level is KingsLevel {
  const l = level as KingsLevel | null;
  return !!l && typeof l.n === 'number' && Array.isArray(l.regions) && Array.isArray(l.solution);
}

/** Guards against a corrupt/stale board shape. */
function sanitizeBoard(board: unknown, n: number): CellState[][] {
  if (!Array.isArray(board) || board.length !== n) return makeEmptyBoard(n);
  for (const row of board) {
    if (!Array.isArray(row) || row.length !== n) return makeEmptyBoard(n);
  }
  return board as CellState[][];
}

const store = createProgressStore<KingsLevel, KingsCustom>({
  storageKey: STORAGE_KEY,
  initialSkillRating: INITIAL_SKILL_RATING,
  nextSkillRating: (prev, input) => nextSkillRating(prev as SkillRating, input as { hintsUsed: number; skipped: boolean }),
  isValidLevel,
  // Pass `urgent: true` only when a player is actively waiting on this
  // specific level (the loading state is on screen) -- it trades a lower
  // chance of the exact skill-matched board for a hard cap on wait time.
  // Background prefetch calls should omit it.
  generate: (levelIndex, skillRating, recentFingerprints, _custom, opts) =>
    createLevelForIndexRobust(levelIndex, skillRating as SkillRating, recentFingerprints, opts?.urgent ? URGENT_DEADLINES : BACKGROUND_DEADLINES),
  fingerprint: (level) => fingerprintRegions(level.regions),
  defaultCustom: () => ({ boardsByLevel: {} }),
  sanitizeCustom: (raw, generatedLevels) => {
    const parsed = (raw ?? {}) as Partial<KingsCustom>;
    const rawBoards = (parsed.boardsByLevel ?? {}) as Record<string, unknown>;
    const boardsByLevel: Record<number, CellState[][]> = {};
    for (const [key, level] of Object.entries(generatedLevels)) {
      boardsByLevel[Number(key)] = sanitizeBoard(rawBoards[key], level.n);
    }
    return { boardsByLevel };
  },
  onLevelGenerated: (custom, level, levelIndex) => ({
    boardsByLevel: { ...custom.boardsByLevel, [levelIndex]: makeEmptyBoard(level.n) },
  }),
  resetLevelCustom: (custom, level, levelIndex) => ({
    boardsByLevel: { ...custom.boardsByLevel, [levelIndex]: makeEmptyBoard(level.n) },
  }),
  // GameScreen extends this same idea by prefetching the *next* level the
  // moment the current one is opened, so the whole play session (not just
  // the win/confetti moment) is the background-generation window --
  // important for n=8-9 boards, which can occasionally take several seconds
  // to find. Only the very first level (this bootstrap call) needs urgent
  // deadlines; prefetch calls elsewhere omit it.
  initialEnsureOpts: { urgent: true },
});

interface KingsProgressContextValue {
  ready: boolean;
  /** Pure lookup -- undefined until `ensureLevel` has generated this index. */
  levelFor: (levelIndex: number) => KingsLevel | undefined;
  /** Generates (and persists) a level for this index if missing. This may
   * update provider state, so call it from an effect or event handler --
   * never from a render body. Safe to call speculatively ahead of need
   * (e.g. to prefetch the next level) since it's a no-op once a level has
   * already been generated for that index. Pass `urgent: true` only when a
   * player is actively waiting on this specific level (the loading state is
   * on screen) -- it trades a lower chance of the exact skill-matched board
   * for a hard cap on wait time. Background prefetch calls should omit it. */
  ensureLevel: (levelIndex: number, opts?: { urgent?: boolean }) => void;
  boardsByLevel: Record<number, CellState[][]>;
  levelsCompleted: Set<number>;
  levelsSkipped: Set<number>;
  tutorialsSeen: Set<string>;
  skillRating: SkillRating;
  cycleCell: (levelIndex: number, r: number, c: number) => void;
  giveHint: (levelIndex: number) => boolean;
  resetLevel: (levelIndex: number) => void;
  markLevelComplete: (levelIndex: number) => void;
  markLevelSkipped: (levelIndex: number) => void;
  markTutorialSeen: (key: string) => void;
  /** Wipes all generated levels, boards, and completion/skip/tutorial state -- for the Settings > Game Progress reset. */
  resetAllProgress: () => void;
}

export const KingsProgressProvider = store.Provider;

export function useKingsProgress(): KingsProgressContextValue {
  const s = store.useProgress();
  const { getCurrent, commit } = s;

  const cycleCell = useCallback(
    (levelIndex: number, r: number, c: number) => {
      const current = getCurrent();
      const board = current.custom.boardsByLevel[levelIndex];
      if (!board) return;
      const nextBoard = board.map((row) => row.slice());
      nextBoard[r][c] = cycleCellState(board[r][c]);
      commit({ ...current, custom: { boardsByLevel: { ...current.custom.boardsByLevel, [levelIndex]: nextBoard } } });
    },
    [getCurrent, commit]
  );

  /** Reveals one correct king as a locked hint cell. Returns false if the level has no hint left to give. */
  const giveHint = useCallback(
    (levelIndex: number): boolean => {
      const current = getCurrent();
      const level = current.generatedLevels[levelIndex];
      const board = current.custom.boardsByLevel[levelIndex];
      if (!level || !board) return false;
      const nextBoard = applyHint(level, board);
      if (!nextBoard) return false;

      commit({
        ...current,
        custom: { boardsByLevel: { ...current.custom.boardsByLevel, [levelIndex]: nextBoard } },
        hintsUsedByLevel: { ...current.hintsUsedByLevel, [levelIndex]: (current.hintsUsedByLevel[levelIndex] ?? 0) + 1 },
      });
      return true;
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
    cycleCell,
    giveHint,
    resetLevel: s.resetLevel,
    markLevelComplete: s.markLevelComplete,
    markLevelSkipped: s.markLevelSkipped,
    markTutorialSeen: s.markTutorialSeen,
    resetAllProgress: s.resetAllProgress,
  };
}
