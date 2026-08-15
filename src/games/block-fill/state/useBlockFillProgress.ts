import { useCallback } from 'react';
import { createProgressStore } from '../../../state/createProgressStore';
import { extendPath, findHintCell, rewindTo } from '../engine';
import { createLevelForIndexRobust, fingerprintBlockFill, INITIAL_SKILL_RATING, nextSkillRating, type SkillRating } from '../generation';
import type { BlockFillLevel, Cell } from '../types';

// v2: internal shape changed when progress moved onto the shared
// createProgressStore -- old entries just get a clean slate (see that
// file's storageKey doc).
const STORAGE_KEY = '@signal-arcade/block-fill/progress/v2';

interface BlockFillCustom {
  /** The live in-progress path -- separate from generatedLevels[idx] so play can resume mid-solve. */
  pathsByLevel: Record<number, Cell[]>;
}

function isValidLevel(level: unknown): level is BlockFillLevel {
  const l = level as BlockFillLevel | null;
  return !!l && typeof l.rows === 'number' && typeof l.cols === 'number' && Array.isArray(l.fillable) && !!l.start;
}

/** Guards against a corrupt/stale path shape -- falls back to a fresh path at the level's start. */
function sanitizePath(path: unknown, level: BlockFillLevel): Cell[] {
  if (!Array.isArray(path) || path.length === 0) return [level.start];
  return path as Cell[];
}

const store = createProgressStore<BlockFillLevel, BlockFillCustom>({
  storageKey: STORAGE_KEY,
  initialSkillRating: INITIAL_SKILL_RATING,
  nextSkillRating: (prev, input) => nextSkillRating(prev as SkillRating, input as { hintsUsed: number; skipped: boolean }),
  isValidLevel,
  generate: (levelIndex, skillRating, recentFingerprints) =>
    createLevelForIndexRobust(levelIndex, skillRating as SkillRating, recentFingerprints),
  // Previously computed by the generator (generateBlockFillLevel) but never
  // actually threaded back into recentFingerprints by the old hand-rolled
  // hook -- the dedup-history array stayed permanently empty. Using the
  // level's own `fillable` grid here (via the generator's own fingerprint
  // fn) is what the generator's `recentFingerprints` param was meant to be
  // checked against all along.
  fingerprint: (level) => fingerprintBlockFill(level.fillable),
  defaultCustom: () => ({ pathsByLevel: {} }),
  sanitizeCustom: (raw, generatedLevels) => {
    const parsed = (raw ?? {}) as Partial<BlockFillCustom>;
    const rawPaths = (parsed.pathsByLevel ?? {}) as Record<string, unknown>;
    const pathsByLevel: Record<number, Cell[]> = {};
    for (const [key, level] of Object.entries(generatedLevels)) {
      pathsByLevel[Number(key)] = sanitizePath(rawPaths[key], level);
    }
    return { pathsByLevel };
  },
  onLevelGenerated: (custom, level, levelIndex) => ({
    pathsByLevel: { ...custom.pathsByLevel, [levelIndex]: [level.start] },
  }),
  resetLevelCustom: (custom, level, levelIndex) => ({
    pathsByLevel: { ...custom.pathsByLevel, [levelIndex]: [level.start] },
  }),
  // `custom` changes on every single cell crossed while dragging, and
  // stringify-ing the whole persisted shape (every level ever generated,
  // kept forever) on every one of those is real JS-thread work stacking up
  // mid-gesture. Debouncing means the write only runs once the finger
  // actually pauses or lifts, never while it's still moving.
  saveDebounceMs: 400,
});

interface BlockFillProgressContextValue {
  ready: boolean;
  /** Pure lookup -- undefined until `ensureLevel` has generated this index. */
  levelFor: (levelIndex: number) => BlockFillLevel | undefined;
  /** Generates (and persists) a level for this index if missing. Safe to call
   * speculatively ahead of need (e.g. to prefetch the next level) since it's
   * a no-op once a level has already been generated for that index. */
  ensureLevel: (levelIndex: number) => void;
  pathsByLevel: Record<number, Cell[]>;
  levelsCompleted: Set<number>;
  levelsSkipped: Set<number>;
  tutorialsSeen: Set<string>;
  skillRating: SkillRating;
  /** Applies a drag-extend if legal (see engine.extendPath). Returns whether it was applied. */
  extend: (levelIndex: number, next: Cell) => boolean;
  /** Applies a rewind-to-trail-point if `cell` is on the path (see engine.rewindTo). Returns whether it was applied. */
  rewind: (levelIndex: number, cell: Cell) => boolean;
  /** Live search for a completion from the current path -- never reads the level's solutionPath certificate (see engine.ts). Returns null if the board is stuck. */
  giveHint: (levelIndex: number) => Cell | null;
  /** Restores the level's path back to just its start cell. */
  resetLevel: (levelIndex: number) => void;
  markLevelComplete: (levelIndex: number) => void;
  markLevelSkipped: (levelIndex: number) => void;
  markTutorialSeen: (key: string) => void;
  /** Wipes all generated levels, paths, and completion/skip/tutorial state -- for the Settings > Game Progress reset. */
  resetAllProgress: () => void;
}

export const BlockFillProgressProvider = store.Provider;

export function useBlockFillProgress(): BlockFillProgressContextValue {
  const s = store.useProgress();
  const { getCurrent, commit } = s;

  const extend = useCallback(
    (levelIndex: number, cell: Cell): boolean => {
      const current = getCurrent();
      const level = current.generatedLevels[levelIndex];
      const path = current.custom.pathsByLevel[levelIndex];
      if (!level || !path) return false;
      const nextPath = extendPath(level, path, cell);
      if (!nextPath) return false;
      commit({ ...current, custom: { pathsByLevel: { ...current.custom.pathsByLevel, [levelIndex]: nextPath } } });
      return true;
    },
    [getCurrent, commit]
  );

  const rewind = useCallback(
    (levelIndex: number, cell: Cell): boolean => {
      const current = getCurrent();
      const path = current.custom.pathsByLevel[levelIndex];
      if (!path) return false;
      const nextPath = rewindTo(path, cell);
      if (!nextPath) return false;
      commit({ ...current, custom: { pathsByLevel: { ...current.custom.pathsByLevel, [levelIndex]: nextPath } } });
      return true;
    },
    [getCurrent, commit]
  );

  const giveHint = useCallback(
    (levelIndex: number): Cell | null => {
      const current = getCurrent();
      const level = current.generatedLevels[levelIndex];
      const path = current.custom.pathsByLevel[levelIndex];
      if (!level || !path) return null;
      const cell = findHintCell(level, path);
      if (!cell) return null;

      commit({ ...current, hintsUsedByLevel: { ...current.hintsUsedByLevel, [levelIndex]: (current.hintsUsedByLevel[levelIndex] ?? 0) + 1 } });
      return cell;
    },
    [getCurrent, commit]
  );

  return {
    ready: s.ready,
    levelFor: s.levelFor,
    ensureLevel: s.ensureLevel,
    pathsByLevel: s.custom.pathsByLevel,
    levelsCompleted: s.levelsCompleted,
    levelsSkipped: s.levelsSkipped,
    tutorialsSeen: s.tutorialsSeen,
    skillRating: s.skillRating as SkillRating,
    extend,
    rewind,
    giveHint,
    resetLevel: s.resetLevel,
    markLevelComplete: s.markLevelComplete,
    markLevelSkipped: s.markLevelSkipped,
    markTutorialSeen: s.markTutorialSeen,
    resetAllProgress: s.resetAllProgress,
  };
}
