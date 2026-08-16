import * as Haptics from 'expo-haptics';
import { useCallback, useMemo } from 'react';
import { createProgressStore } from '../../../state/createProgressStore';
import { applyHint, applyTool, computeSums, makeInitialMarks, type CellMark, type Tool } from '../engine';
import { createLevelForIndexRobust, fingerprintCrossSums, INITIAL_SKILL_RATING, nextSkillRating, type SkillRating } from '../generation';
import type { CrossSumsLevel } from '../types';

// v3: internal shape changed when progress moved onto the shared
// createProgressStore -- old entries just get a clean slate (see that
// file's storageKey doc).
const STORAGE_KEY = '@signal-arcade/cross-sums/progress/v3';

interface CrossSumsCustom {
  marksByLevel: Record<number, CellMark[][]>;
  /** "r,c" keys revealed via Hint -- locked, can't be toggled back. */
  hintedCellsByLevel: Record<number, string[]>;
}

function isValidLevel(level: unknown): level is CrossSumsLevel {
  const l = level as CrossSumsLevel | null;
  return !!l && typeof l.rows === 'number' && typeof l.cols === 'number' && Array.isArray(l.grid) && Array.isArray(l.solutionMask);
}

const VALID_MARKS = new Set<CellMark>(['neutral', 'selected', 'erased']);

/** Guards against a corrupt/stale marks shape (including the old v1 boolean mask). */
function sanitizeMarks(marks: unknown, rows: number, cols: number): CellMark[][] {
  if (!Array.isArray(marks) || marks.length !== rows) return makeInitialMarks(rows, cols);
  for (const row of marks) {
    if (!Array.isArray(row) || row.length !== cols || !row.every((cell) => VALID_MARKS.has(cell))) {
      return makeInitialMarks(rows, cols);
    }
  }
  return marks as CellMark[][];
}

const store = createProgressStore<CrossSumsLevel, CrossSumsCustom>({
  storageKey: STORAGE_KEY,
  initialSkillRating: INITIAL_SKILL_RATING,
  nextSkillRating: (prev, input) => nextSkillRating(prev as SkillRating, input as { hintsUsed: number; skipped: boolean }),
  isValidLevel,
  generate: (levelIndex, skillRating, recentFingerprints) =>
    createLevelForIndexRobust(levelIndex, skillRating as SkillRating, recentFingerprints),
  fingerprint: (level) => fingerprintCrossSums(level.grid, level.rowTargets, level.colTargets),
  defaultCustom: () => ({ marksByLevel: {}, hintedCellsByLevel: {} }),
  sanitizeCustom: (raw, generatedLevels) => {
    const parsed = (raw ?? {}) as Partial<CrossSumsCustom>;
    const rawMarks = (parsed.marksByLevel ?? {}) as Record<string, unknown>;
    const rawHinted = (parsed.hintedCellsByLevel ?? {}) as Record<string, unknown>;
    const marksByLevel: Record<number, CellMark[][]> = {};
    const hintedCellsByLevel: Record<number, string[]> = {};
    for (const [key, level] of Object.entries(generatedLevels)) {
      const idx = Number(key);
      marksByLevel[idx] = sanitizeMarks(rawMarks[key], level.rows, level.cols);
      hintedCellsByLevel[idx] = Array.isArray(rawHinted[key]) ? (rawHinted[key] as string[]) : [];
    }
    return { marksByLevel, hintedCellsByLevel };
  },
  onLevelGenerated: (custom, level, levelIndex) => ({
    marksByLevel: { ...custom.marksByLevel, [levelIndex]: makeInitialMarks(level.rows, level.cols) },
    hintedCellsByLevel: { ...custom.hintedCellsByLevel, [levelIndex]: [] },
  }),
  resetLevelCustom: (custom, level, levelIndex) => ({
    marksByLevel: { ...custom.marksByLevel, [levelIndex]: makeInitialMarks(level.rows, level.cols) },
    hintedCellsByLevel: { ...custom.hintedCellsByLevel, [levelIndex]: [] },
  }),
});

interface CrossSumsProgressContextValue {
  ready: boolean;
  /** Pure lookup -- undefined until `ensureLevel` has generated this index. */
  levelFor: (levelIndex: number) => CrossSumsLevel | undefined;
  /** Generates (and persists) a level for this index if missing. This may
   * update provider state, so call it from an effect or event handler --
   * never from a render body. Safe to call speculatively ahead of need
   * (e.g. to prefetch the next level) since it's a no-op once a level has
   * already been generated for that index. */
  ensureLevel: (levelIndex: number) => void;
  marksByLevel: Record<number, CellMark[][]>;
  hintedCellsByLevel: Record<number, Set<string>>;
  levelsCompleted: Set<number>;
  levelsSkipped: Set<number>;
  tutorialsSeen: Set<string>;
  skillRating: SkillRating;
  toggleCellAt: (levelIndex: number, r: number, c: number, tool: Tool) => void;
  giveHint: (levelIndex: number) => boolean;
  resetLevel: (levelIndex: number) => void;
  markLevelComplete: (levelIndex: number) => void;
  markLevelSkipped: (levelIndex: number) => void;
  markTutorialSeen: (key: string) => void;
  /** Wipes all generated levels, masks, and completion/skip/tutorial state -- for the Settings > Game Progress reset. */
  resetAllProgress: () => void;
}

export const CrossSumsProgressProvider = store.Provider;

export function useCrossSumsProgress(): CrossSumsProgressContextValue {
  const s = store.useProgress();
  const { getCurrent, commit } = s;

  const hintedCellsByLevel = useMemo(() => {
    const out: Record<number, Set<string>> = {};
    for (const [key, cells] of Object.entries(s.custom.hintedCellsByLevel)) out[Number(key)] = new Set(cells);
    return out;
  }, [s.custom.hintedCellsByLevel]);

  const toggleCellAt = useCallback(
    (levelIndex: number, r: number, c: number, tool: Tool) => {
      const current = getCurrent();
      const level = current.generatedLevels[levelIndex];
      const marks = current.custom.marksByLevel[levelIndex];
      if (!level || !marks) return;
      const hinted = current.custom.hintedCellsByLevel[levelIndex] ?? [];
      if (hinted.includes(`${r},${c}`)) return;

      const nextMarks = applyTool(marks, r, c, tool);

      const before = computeSums(level.grid, marks);
      const after = computeSums(level.grid, nextMarks);
      const rowJustMatched = before.rowSums[r] !== level.rowTargets[r] && after.rowSums[r] === level.rowTargets[r];
      const colJustMatched = before.colSums[c] !== level.colTargets[c] && after.colSums[c] === level.colTargets[c];
      if (rowJustMatched || colJustMatched) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      commit({ ...current, custom: { ...current.custom, marksByLevel: { ...current.custom.marksByLevel, [levelIndex]: nextMarks } } });
    },
    [getCurrent, commit]
  );

  /** Reveals one currently-wrong cell and locks it. Returns false if the level has no hint left to give. */
  const giveHint = useCallback(
    (levelIndex: number): boolean => {
      const current = getCurrent();
      const level = current.generatedLevels[levelIndex];
      const marks = current.custom.marksByLevel[levelIndex];
      if (!level || !marks) return false;
      const result = applyHint(level, marks);
      if (!result) return false;

      const hinted = current.custom.hintedCellsByLevel[levelIndex] ?? [];
      commit({
        ...current,
        custom: {
          marksByLevel: { ...current.custom.marksByLevel, [levelIndex]: result.marks },
          hintedCellsByLevel: { ...current.custom.hintedCellsByLevel, [levelIndex]: hinted.concat(`${result.r},${result.c}`) },
        },
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
    marksByLevel: s.custom.marksByLevel,
    hintedCellsByLevel,
    levelsCompleted: s.levelsCompleted,
    levelsSkipped: s.levelsSkipped,
    tutorialsSeen: s.tutorialsSeen,
    skillRating: s.skillRating as SkillRating,
    toggleCellAt,
    giveHint,
    resetLevel: s.resetLevel,
    markLevelComplete: s.markLevelComplete,
    markLevelSkipped: s.markLevelSkipped,
    markTutorialSeen: s.markTutorialSeen,
    resetAllProgress: s.resetAllProgress,
  };
}
