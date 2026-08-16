import * as Haptics from 'expo-haptics';
import { useCallback, useMemo } from 'react';
import { createProgressStore } from '../../../state/createProgressStore';
import { applyHint, clueIndicesIn, containsCell, placeRect, removeRectAt } from '../engine';
import {
  createLevelForIndexRobust,
  fingerprintShikaku,
  INITIAL_SKILL_RATING,
  nextSkillRating,
  type SkillRating,
} from '../generation';
import type { RectBounds, ShikakuLevel, ShikakuPlayerState } from '../types';

// v2: internal shape changed when progress moved onto the shared
// createProgressStore -- old entries just get a clean slate (see that
// file's storageKey doc).
const STORAGE_KEY = '@signal-arcade/shikaku/progress/v2';

interface ShikakuCustom {
  /** Every level a player has reached is generated once and kept forever --
   * replaying an old level must show the same puzzle even after skill rating
   * has moved on. */
  placedByLevel: Record<number, ShikakuPlayerState>;
  /** Clue indices revealed via Hint -- locked, their rectangle can't be redrawn or deleted. */
  hintedClueIndicesByLevel: Record<number, number[]>;
}

function isValidLevel(level: unknown): level is ShikakuLevel {
  const l = level as ShikakuLevel | null;
  return !!l && typeof l.rows === 'number' && typeof l.cols === 'number' && Array.isArray(l.clues) && Array.isArray(l.solutionRects);
}

/** Guards against a corrupt/stale placed-rects shape. */
function sanitizePlaced(placed: unknown): ShikakuPlayerState {
  if (!Array.isArray(placed)) return [];
  return placed.filter(
    (rect): rect is ShikakuPlayerState[number] =>
      !!rect &&
      typeof rect.r0 === 'number' &&
      typeof rect.c0 === 'number' &&
      typeof rect.r1 === 'number' &&
      typeof rect.c1 === 'number' &&
      typeof rect.clueIndex === 'number'
  );
}

const store = createProgressStore<ShikakuLevel, ShikakuCustom>({
  storageKey: STORAGE_KEY,
  initialSkillRating: INITIAL_SKILL_RATING,
  nextSkillRating: (prev, input) => nextSkillRating(prev as SkillRating, input as { hintsUsed: number; skipped: boolean }),
  isValidLevel,
  generate: (levelIndex, skillRating, recentFingerprints) =>
    createLevelForIndexRobust(levelIndex, skillRating as SkillRating, recentFingerprints),
  fingerprint: (level) => fingerprintShikaku(level.rows, level.cols, level.clues),
  defaultCustom: () => ({ placedByLevel: {}, hintedClueIndicesByLevel: {} }),
  sanitizeCustom: (raw, generatedLevels) => {
    const parsed = (raw ?? {}) as Partial<ShikakuCustom>;
    const rawPlaced = (parsed.placedByLevel ?? {}) as Record<string, unknown>;
    const rawHinted = (parsed.hintedClueIndicesByLevel ?? {}) as Record<string, unknown>;
    const placedByLevel: Record<number, ShikakuPlayerState> = {};
    const hintedClueIndicesByLevel: Record<number, number[]> = {};
    for (const key of Object.keys(generatedLevels)) {
      const idx = Number(key);
      placedByLevel[idx] = sanitizePlaced(rawPlaced[key]);
      hintedClueIndicesByLevel[idx] = Array.isArray(rawHinted[key]) ? (rawHinted[key] as number[]) : [];
    }
    return { placedByLevel, hintedClueIndicesByLevel };
  },
  onLevelGenerated: (custom, _level, levelIndex) => ({
    placedByLevel: { ...custom.placedByLevel, [levelIndex]: [] },
    hintedClueIndicesByLevel: { ...custom.hintedClueIndicesByLevel, [levelIndex]: [] },
  }),
  resetLevelCustom: (custom, _level, levelIndex) => ({
    placedByLevel: { ...custom.placedByLevel, [levelIndex]: [] },
    hintedClueIndicesByLevel: { ...custom.hintedClueIndicesByLevel, [levelIndex]: [] },
  }),
});

interface ShikakuProgressContextValue {
  ready: boolean;
  /** Pure lookup -- undefined until `ensureLevel` has generated this index. */
  levelFor: (levelIndex: number) => ShikakuLevel | undefined;
  /** Generates (and persists) a level for this index if missing. This may
   * update provider state, so call it from an effect or event handler --
   * never from a render body. Safe to call speculatively ahead of need
   * (e.g. to prefetch the next level) since it's a no-op once a level has
   * already been generated for that index. */
  ensureLevel: (levelIndex: number) => void;
  placedByLevel: Record<number, ShikakuPlayerState>;
  hintedClueIndicesByLevel: Record<number, Set<number>>;
  levelsCompleted: Set<number>;
  levelsSkipped: Set<number>;
  tutorialsSeen: Set<string>;
  skillRating: SkillRating;
  /** Attempts to place/resize `candidate`. No-ops (no state change) on any
   * invalid move shape (0/2+ clues covered, overlap) or on a candidate that
   * targets an already-hinted clue -- hinted clues are locked here, not in
   * engine.ts, per the approved plan. */
  commitRectAt: (levelIndex: number, candidate: RectBounds) => void;
  /** Deletes the rect covering (r, c), if any and not locked. No-op otherwise. */
  tapCellAt: (levelIndex: number, r: number, c: number) => void;
  giveHint: (levelIndex: number) => boolean;
  resetLevel: (levelIndex: number) => void;
  markLevelComplete: (levelIndex: number) => void;
  markLevelSkipped: (levelIndex: number) => void;
  markTutorialSeen: (key: string) => void;
  /** Wipes all generated levels, placed rects, and completion/skip/tutorial state -- for the Settings > Game Progress reset. */
  resetAllProgress: () => void;
}

export const ShikakuProgressProvider = store.Provider;

export function useShikakuProgress(): ShikakuProgressContextValue {
  const s = store.useProgress();
  const { getCurrent, commit } = s;

  const hintedClueIndicesByLevel = useMemo(() => {
    const out: Record<number, Set<number>> = {};
    for (const [key, indices] of Object.entries(s.custom.hintedClueIndicesByLevel)) out[Number(key)] = new Set(indices);
    return out;
  }, [s.custom.hintedClueIndicesByLevel]);

  const commitRectAt = useCallback(
    (levelIndex: number, candidate: RectBounds) => {
      const current = getCurrent();
      const level = current.generatedLevels[levelIndex];
      const placed = current.custom.placedByLevel[levelIndex];
      if (!level || !placed) return;

      const hinted = current.custom.hintedClueIndicesByLevel[levelIndex] ?? [];
      const targetClueIndices = clueIndicesIn(level.clues, candidate);
      if (targetClueIndices.length === 1 && hinted.includes(targetClueIndices[0])) return;

      const result = placeRect(level, placed, candidate);
      if ('error' in result) return;

      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      commit({
        ...current,
        custom: { ...current.custom, placedByLevel: { ...current.custom.placedByLevel, [levelIndex]: result.placedRects } },
      });
    },
    [getCurrent, commit]
  );

  const tapCellAt = useCallback(
    (levelIndex: number, r: number, c: number) => {
      const current = getCurrent();
      const placed = current.custom.placedByLevel[levelIndex];
      if (!placed) return;

      const covering = placed.find((rect) => containsCell(rect, r, c));
      if (!covering) return;

      const hinted = current.custom.hintedClueIndicesByLevel[levelIndex] ?? [];
      if (hinted.includes(covering.clueIndex)) return;

      const nextPlaced = removeRectAt(placed, r, c);
      commit({ ...current, custom: { ...current.custom, placedByLevel: { ...current.custom.placedByLevel, [levelIndex]: nextPlaced } } });
    },
    [getCurrent, commit]
  );

  /** Reveals one currently-wrong (or unplaced) clue's correct rectangle and locks it. Returns false if every clue already matches the solution. */
  const giveHint = useCallback(
    (levelIndex: number): boolean => {
      const current = getCurrent();
      const level = current.generatedLevels[levelIndex];
      const placed = current.custom.placedByLevel[levelIndex];
      if (!level || !placed) return false;
      const result = applyHint(level, placed);
      if (!result) return false;

      const hinted = current.custom.hintedClueIndicesByLevel[levelIndex] ?? [];
      const nextHinted = hinted.includes(result.clueIndex) ? hinted : hinted.concat(result.clueIndex);
      commit({
        ...current,
        custom: {
          placedByLevel: { ...current.custom.placedByLevel, [levelIndex]: result.placedRects },
          hintedClueIndicesByLevel: { ...current.custom.hintedClueIndicesByLevel, [levelIndex]: nextHinted },
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
    placedByLevel: s.custom.placedByLevel,
    hintedClueIndicesByLevel,
    levelsCompleted: s.levelsCompleted,
    levelsSkipped: s.levelsSkipped,
    tutorialsSeen: s.tutorialsSeen,
    skillRating: s.skillRating as SkillRating,
    commitRectAt,
    tapCellAt,
    giveHint,
    resetLevel: s.resetLevel,
    markLevelComplete: s.markLevelComplete,
    markLevelSkipped: s.markLevelSkipped,
    markTutorialSeen: s.markTutorialSeen,
    resetAllProgress: s.resetAllProgress,
  };
}
