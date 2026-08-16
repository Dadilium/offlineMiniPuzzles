import * as Haptics from 'expo-haptics';
import { useCallback, useMemo } from 'react';
import { createProgressStore } from '../../../state/createProgressStore';
import { applyHint, computeCounts, makeInitialTents, toggleTent } from '../engine';
import {
  createLevelForIndexRobust,
  fingerprintTentsAndTrees,
  INITIAL_SKILL_RATING,
  nextSkillRating,
  type SkillRating,
} from '../generation';
import type { TentsAndTreesLevel } from '../types';

// v3: internal shape changed when progress moved onto the shared
// createProgressStore -- old entries just get a clean slate (see that
// file's storageKey doc). Previously bumped to v2 for the pair-placement
// fix in generation/generator.ts -- see that history if this ever needs
// cross-referencing.
const STORAGE_KEY = '@signal-arcade/tents-and-trees/progress/v3';

interface TentsAndTreesCustom {
  tentsByLevel: Record<number, boolean[][]>;
  /** "r,c" keys revealed via Hint -- locked, can't be toggled back. */
  hintedCellsByLevel: Record<number, string[]>;
}

function isValidLevel(level: unknown): level is TentsAndTreesLevel {
  const l = level as TentsAndTreesLevel | null;
  return !!l && typeof l.rows === 'number' && typeof l.cols === 'number' && Array.isArray(l.trees) && Array.isArray(l.solutionTents);
}

/** Guards against a corrupt/stale tents shape. */
function sanitizeTents(tents: unknown, rows: number, cols: number): boolean[][] {
  if (!Array.isArray(tents) || tents.length !== rows) return makeInitialTents(rows, cols);
  for (const row of tents) {
    if (!Array.isArray(row) || row.length !== cols) return makeInitialTents(rows, cols);
  }
  return tents as boolean[][];
}

const store = createProgressStore<TentsAndTreesLevel, TentsAndTreesCustom>({
  storageKey: STORAGE_KEY,
  initialSkillRating: INITIAL_SKILL_RATING,
  nextSkillRating: (prev, input) => nextSkillRating(prev as SkillRating, input as { hintsUsed: number; skipped: boolean }),
  isValidLevel,
  generate: (levelIndex, skillRating, recentFingerprints) =>
    createLevelForIndexRobust(levelIndex, skillRating as SkillRating, recentFingerprints),
  fingerprint: (level) => fingerprintTentsAndTrees(level.trees, level.rowTargets, level.colTargets),
  defaultCustom: () => ({ tentsByLevel: {}, hintedCellsByLevel: {} }),
  sanitizeCustom: (raw, generatedLevels) => {
    const parsed = (raw ?? {}) as Partial<TentsAndTreesCustom>;
    const rawTents = (parsed.tentsByLevel ?? {}) as Record<string, unknown>;
    const rawHinted = (parsed.hintedCellsByLevel ?? {}) as Record<string, unknown>;
    const tentsByLevel: Record<number, boolean[][]> = {};
    const hintedCellsByLevel: Record<number, string[]> = {};
    for (const [key, level] of Object.entries(generatedLevels)) {
      const idx = Number(key);
      tentsByLevel[idx] = sanitizeTents(rawTents[key], level.rows, level.cols);
      hintedCellsByLevel[idx] = Array.isArray(rawHinted[key]) ? (rawHinted[key] as string[]) : [];
    }
    return { tentsByLevel, hintedCellsByLevel };
  },
  onLevelGenerated: (custom, level, levelIndex) => ({
    tentsByLevel: { ...custom.tentsByLevel, [levelIndex]: makeInitialTents(level.rows, level.cols) },
    hintedCellsByLevel: { ...custom.hintedCellsByLevel, [levelIndex]: [] },
  }),
  resetLevelCustom: (custom, level, levelIndex) => ({
    tentsByLevel: { ...custom.tentsByLevel, [levelIndex]: makeInitialTents(level.rows, level.cols) },
    hintedCellsByLevel: { ...custom.hintedCellsByLevel, [levelIndex]: [] },
  }),
});

interface TentsAndTreesProgressContextValue {
  ready: boolean;
  /** Pure lookup -- undefined until `ensureLevel` has generated this index. */
  levelFor: (levelIndex: number) => TentsAndTreesLevel | undefined;
  /** Generates (and persists) a level for this index if missing. This may
   * update provider state, so call it from an effect or event handler --
   * never from a render body. Safe to call speculatively ahead of need
   * (e.g. to prefetch the next level) since it's a no-op once a level has
   * already been generated for that index. */
  ensureLevel: (levelIndex: number) => void;
  tentsByLevel: Record<number, boolean[][]>;
  hintedCellsByLevel: Record<number, Set<string>>;
  levelsCompleted: Set<number>;
  levelsSkipped: Set<number>;
  tutorialsSeen: Set<string>;
  skillRating: SkillRating;
  toggleTentAt: (levelIndex: number, r: number, c: number) => void;
  giveHint: (levelIndex: number) => boolean;
  resetLevel: (levelIndex: number) => void;
  markLevelComplete: (levelIndex: number) => void;
  markLevelSkipped: (levelIndex: number) => void;
  markTutorialSeen: (key: string) => void;
  /** Wipes all generated levels, tents, and completion/skip/tutorial state -- for the Settings > Game Progress reset. */
  resetAllProgress: () => void;
}

export const TentsAndTreesProgressProvider = store.Provider;

export function useTentsAndTreesProgress(): TentsAndTreesProgressContextValue {
  const s = store.useProgress();
  const { getCurrent, commit } = s;

  const hintedCellsByLevel = useMemo(() => {
    const out: Record<number, Set<string>> = {};
    for (const [key, cells] of Object.entries(s.custom.hintedCellsByLevel)) out[Number(key)] = new Set(cells);
    return out;
  }, [s.custom.hintedCellsByLevel]);

  const toggleTentAt = useCallback(
    (levelIndex: number, r: number, c: number) => {
      const current = getCurrent();
      const level = current.generatedLevels[levelIndex];
      const tents = current.custom.tentsByLevel[levelIndex];
      if (!level || !tents) return;
      const hinted = current.custom.hintedCellsByLevel[levelIndex] ?? [];
      if (hinted.includes(`${r},${c}`)) return;

      const nextTents = toggleTent(tents, r, c);

      const before = computeCounts(tents);
      const after = computeCounts(nextTents);
      const rowJustMatched = before.rowCounts[r] !== level.rowTargets[r] && after.rowCounts[r] === level.rowTargets[r];
      const colJustMatched = before.colCounts[c] !== level.colTargets[c] && after.colCounts[c] === level.colTargets[c];
      if (rowJustMatched || colJustMatched) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      commit({ ...current, custom: { ...current.custom, tentsByLevel: { ...current.custom.tentsByLevel, [levelIndex]: nextTents } } });
    },
    [getCurrent, commit]
  );

  /** Reveals one currently-wrong cell and locks it. Returns false if the level has no hint left to give. */
  const giveHint = useCallback(
    (levelIndex: number): boolean => {
      const current = getCurrent();
      const level = current.generatedLevels[levelIndex];
      const tents = current.custom.tentsByLevel[levelIndex];
      if (!level || !tents) return false;
      const result = applyHint(level, tents);
      if (!result) return false;

      const hinted = current.custom.hintedCellsByLevel[levelIndex] ?? [];
      commit({
        ...current,
        custom: {
          tentsByLevel: { ...current.custom.tentsByLevel, [levelIndex]: result.tents },
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
    tentsByLevel: s.custom.tentsByLevel,
    hintedCellsByLevel,
    levelsCompleted: s.levelsCompleted,
    levelsSkipped: s.levelsSkipped,
    tutorialsSeen: s.tutorialsSeen,
    skillRating: s.skillRating as SkillRating,
    toggleTentAt,
    giveHint,
    resetLevel: s.resetLevel,
    markLevelComplete: s.markLevelComplete,
    markLevelSkipped: s.markLevelSkipped,
    markTutorialSeen: s.markTutorialSeen,
    resetAllProgress: s.resetAllProgress,
  };
}
