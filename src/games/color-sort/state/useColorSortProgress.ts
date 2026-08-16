import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { createProgressStore } from '../../../state/createProgressStore';
import { findBestMove, isTubeFilledSolid } from '../engine';
import { createLevelForIndexRobust, fingerprintColorSort, INITIAL_SKILL_RATING, nextSkillRating, pourMove, type Move, type SkillRating } from '../generation';
import type { ColorSortLevel, Tube } from '../types';

// v2: internal shape changed when progress moved onto the shared
// createProgressStore -- old entries just get a clean slate (see that
// file's storageKey doc).
const STORAGE_KEY = '@signal-arcade/color-sort/progress/v2';

interface ColorSortCustom {
  /** The live in-progress arrangement -- separate from generatedLevels[idx].tubes so play can resume mid-solve. */
  tubesByLevel: Record<number, Tube[]>;
  moveCountByLevel: Record<number, number>;
  /** Colorblind-friendly mode toggle (per-player preference, not per-level) -- see ColorSortBoard/palette.ts. Off by default. */
  showColorblindIcons: boolean;
}

function isValidLevel(level: unknown): level is ColorSortLevel {
  const l = level as ColorSortLevel | null;
  return !!l && typeof l.capacity === 'number' && typeof l.colors === 'number' && Array.isArray(l.tubes);
}

/** Guards against a corrupt/stale tubes shape -- falls back to the level's own fresh starting arrangement. */
function sanitizeTubes(tubes: unknown, level: ColorSortLevel): Tube[] {
  if (!Array.isArray(tubes) || tubes.length !== level.tubes.length) return level.tubes.map((t) => t.slice());
  for (const tube of tubes) {
    if (!Array.isArray(tube)) return level.tubes.map((t) => t.slice());
  }
  return tubes as Tube[];
}

const store = createProgressStore<ColorSortLevel, ColorSortCustom>({
  storageKey: STORAGE_KEY,
  initialSkillRating: INITIAL_SKILL_RATING,
  nextSkillRating: (prev, input) => nextSkillRating(prev as SkillRating, input as { hintsUsed: number; skipped: boolean }),
  isValidLevel,
  generate: (levelIndex, skillRating, recentFingerprints) =>
    createLevelForIndexRobust(levelIndex, skillRating as SkillRating, recentFingerprints),
  fingerprint: (level) => fingerprintColorSort(level.tubes, level.capacity),
  defaultCustom: () => ({ tubesByLevel: {}, moveCountByLevel: {}, showColorblindIcons: false }),
  sanitizeCustom: (raw, generatedLevels) => {
    const parsed = (raw ?? {}) as Partial<ColorSortCustom>;
    const rawTubes = (parsed.tubesByLevel ?? {}) as Record<string, unknown>;
    const rawMoveCount = (parsed.moveCountByLevel ?? {}) as Record<string, unknown>;
    const tubesByLevel: Record<number, Tube[]> = {};
    const moveCountByLevel: Record<number, number> = {};
    for (const [key, level] of Object.entries(generatedLevels)) {
      const idx = Number(key);
      tubesByLevel[idx] = sanitizeTubes(rawTubes[key], level);
      moveCountByLevel[idx] = typeof rawMoveCount[key] === 'number' ? (rawMoveCount[key] as number) : 0;
    }
    return { tubesByLevel, moveCountByLevel, showColorblindIcons: parsed.showColorblindIcons === true };
  },
  onLevelGenerated: (custom, level, levelIndex) => ({
    ...custom,
    tubesByLevel: { ...custom.tubesByLevel, [levelIndex]: level.tubes.map((t) => t.slice()) },
    moveCountByLevel: { ...custom.moveCountByLevel, [levelIndex]: 0 },
  }),
  resetLevelCustom: (custom, level, levelIndex) => ({
    ...custom,
    tubesByLevel: { ...custom.tubesByLevel, [levelIndex]: level.tubes.map((t) => t.slice()) },
    moveCountByLevel: { ...custom.moveCountByLevel, [levelIndex]: 0 },
  }),
});

interface ColorSortProgressContextValue {
  ready: boolean;
  /** Pure lookup -- undefined until `ensureLevel` has generated this index. */
  levelFor: (levelIndex: number) => ColorSortLevel | undefined;
  /** Generates (and persists) a level for this index if missing. Safe to call
   * speculatively ahead of need (e.g. to prefetch the next level) since it's
   * a no-op once a level has already been generated for that index. */
  ensureLevel: (levelIndex: number) => void;
  tubesByLevel: Record<number, Tube[]>;
  moveCountByLevel: Record<number, number>;
  levelsCompleted: Set<number>;
  levelsSkipped: Set<number>;
  tutorialsSeen: Set<string>;
  skillRating: SkillRating;
  /** Applies a pour if legal (see engine.pourMove). Returns whether it was applied. */
  pourAt: (levelIndex: number, from: number, to: number) => boolean;
  /** Live search for a completion from the current tubes -- never reads a
   * precomputed solution (see engine.findBestMove). Returns null if stuck. */
  giveHint: (levelIndex: number) => Move | null;
  /** Restores the level's tubes back to their generated starting arrangement. */
  resetLevel: (levelIndex: number) => void;
  /** Restores tubes to a caller-supplied prior snapshot and rolls moveCount back by one -- backs the undo-last-move button, whose history lives in the screen, not here. */
  undoMove: (levelIndex: number, tubes: Tube[]) => void;
  markLevelComplete: (levelIndex: number) => void;
  markLevelSkipped: (levelIndex: number) => void;
  markTutorialSeen: (key: string) => void;
  /** Wipes all generated levels, tubes, and completion/skip/tutorial state -- for the Settings > Game Progress reset. */
  resetAllProgress: () => void;
  /** Colorblind-friendly mode: overlays a shape icon on every tube unit. Off by default -- see ColorSortBoard/palette.ts. */
  showColorblindIcons: boolean;
  setShowColorblindIcons: (value: boolean) => void;
}

export const ColorSortProgressProvider = store.Provider;

export function useColorSortProgress(): ColorSortProgressContextValue {
  const s = store.useProgress();
  const { getCurrent, commit } = s;

  const pourAt = useCallback(
    (levelIndex: number, from: number, to: number): boolean => {
      const current = getCurrent();
      const level = current.generatedLevels[levelIndex];
      const tubes = current.custom.tubesByLevel[levelIndex];
      if (!level || !tubes) return false;
      const result = pourMove(tubes, level.capacity, from, to);
      if (!result) return false;

      const justCompleted = [from, to].some(
        (i) => !isTubeFilledSolid(tubes[i], level.capacity) && isTubeFilledSolid(result.tubes[i], level.capacity)
      );
      if (justCompleted) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      commit({
        ...current,
        custom: {
          ...current.custom,
          tubesByLevel: { ...current.custom.tubesByLevel, [levelIndex]: result.tubes },
          moveCountByLevel: { ...current.custom.moveCountByLevel, [levelIndex]: (current.custom.moveCountByLevel[levelIndex] ?? 0) + 1 },
        },
      });
      return true;
    },
    [getCurrent, commit]
  );

  const giveHint = useCallback(
    (levelIndex: number): Move | null => {
      const current = getCurrent();
      const level = current.generatedLevels[levelIndex];
      const tubes = current.custom.tubesByLevel[levelIndex];
      if (!level || !tubes) return null;
      const move = findBestMove(tubes, level.capacity);
      if (!move) return null;

      commit({ ...current, hintsUsedByLevel: { ...current.hintsUsedByLevel, [levelIndex]: (current.hintsUsedByLevel[levelIndex] ?? 0) + 1 } });
      return move;
    },
    [getCurrent, commit]
  );

  const undoMove = useCallback(
    (levelIndex: number, tubes: Tube[]) => {
      const current = getCurrent();
      if (!current.generatedLevels[levelIndex]) return;
      commit({
        ...current,
        custom: {
          ...current.custom,
          tubesByLevel: { ...current.custom.tubesByLevel, [levelIndex]: tubes },
          moveCountByLevel: {
            ...current.custom.moveCountByLevel,
            [levelIndex]: Math.max(0, (current.custom.moveCountByLevel[levelIndex] ?? 0) - 1),
          },
        },
      });
    },
    [getCurrent, commit]
  );

  const setShowColorblindIcons = useCallback(
    (value: boolean) => {
      const current = getCurrent();
      commit({ ...current, custom: { ...current.custom, showColorblindIcons: value } });
    },
    [getCurrent, commit]
  );

  return {
    ready: s.ready,
    levelFor: s.levelFor,
    ensureLevel: s.ensureLevel,
    tubesByLevel: s.custom.tubesByLevel,
    moveCountByLevel: s.custom.moveCountByLevel,
    levelsCompleted: s.levelsCompleted,
    levelsSkipped: s.levelsSkipped,
    tutorialsSeen: s.tutorialsSeen,
    skillRating: s.skillRating as SkillRating,
    pourAt,
    giveHint,
    resetLevel: s.resetLevel,
    undoMove,
    markLevelComplete: s.markLevelComplete,
    markLevelSkipped: s.markLevelSkipped,
    markTutorialSeen: s.markTutorialSeen,
    resetAllProgress: s.resetAllProgress,
    showColorblindIcons: s.custom.showColorblindIcons,
    setShowColorblindIcons,
  };
}
