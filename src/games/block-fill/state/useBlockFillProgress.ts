import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { extendPath, findHintCell, rewindTo } from '../engine';
import { createLevelForIndexRobust, INITIAL_SKILL_RATING, nextSkillRating, type SkillRating } from '../generation';
import type { BlockFillLevel, Cell } from '../types';

const STORAGE_KEY = '@signal-arcade/block-fill/progress/v1';
/** Bounds the shape-dedup history so it can't grow unbounded over 1000+ levels. */
const MAX_RECENT_FINGERPRINTS = 50;

interface PersistedShape {
  /** Every level a player has reached is generated once and kept forever --
   * replaying an old level must show the same puzzle even after skill rating
   * has moved on. Keyed by level index. */
  generatedLevels: Record<number, BlockFillLevel>;
  /** The live in-progress path -- separate from generatedLevels[idx] so play can resume mid-solve. */
  pathsByLevel: Record<number, Cell[]>;
  levelsCompleted: number[];
  levelsSkipped: number[];
  tutorialsSeen: string[];
  skillRating: SkillRating;
  recentFingerprints: string[];
  hintsUsedByLevel: Record<number, number>;
}

function defaultState(): PersistedShape {
  return {
    generatedLevels: {},
    pathsByLevel: {},
    levelsCompleted: [],
    levelsSkipped: [],
    tutorialsSeen: [],
    skillRating: INITIAL_SKILL_RATING,
    recentFingerprints: [],
    hintsUsedByLevel: {},
  };
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

function sanitizePersisted(parsed: Partial<PersistedShape> | null): PersistedShape {
  if (!parsed) return defaultState();

  const generatedLevels: Record<number, BlockFillLevel> = {};
  const pathsByLevel: Record<number, Cell[]> = {};
  const rawPaths = (parsed.pathsByLevel ?? {}) as Record<string, unknown>;

  for (const [key, level] of Object.entries(parsed.generatedLevels ?? {})) {
    if (!isValidLevel(level)) continue;
    const idx = Number(key);
    generatedLevels[idx] = level;
    pathsByLevel[idx] = sanitizePath(rawPaths[key], level);
  }

  return {
    generatedLevels,
    pathsByLevel,
    levelsCompleted: Array.isArray(parsed.levelsCompleted) ? parsed.levelsCompleted : [],
    levelsSkipped: Array.isArray(parsed.levelsSkipped) ? parsed.levelsSkipped : [],
    tutorialsSeen: Array.isArray(parsed.tutorialsSeen) ? parsed.tutorialsSeen : [],
    skillRating: typeof parsed.skillRating === 'number' ? parsed.skillRating : INITIAL_SKILL_RATING,
    recentFingerprints: Array.isArray(parsed.recentFingerprints) ? parsed.recentFingerprints.slice(-MAX_RECENT_FINGERPRINTS) : [],
    hintsUsedByLevel:
      parsed.hintsUsedByLevel && typeof parsed.hintsUsedByLevel === 'object' ? (parsed.hintsUsedByLevel as Record<number, number>) : {},
  };
}

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

const BlockFillProgressContext = createContext<BlockFillProgressContextValue | null>(null);

export function BlockFillProgressProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PersistedShape>(defaultState);
  const [ready, setReady] = useState(false);
  const loadedOnce = useRef(false);
  // Mirrors `state` but updated synchronously (ahead of React's re-render),
  // so back-to-back calls in the same tick both see fresh data instead of
  // racing against a stale closure over `state`.
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as Partial<PersistedShape>) : null;
        const sanitized = sanitizePersisted(parsed);
        stateRef.current = sanitized;
        setState(sanitized);
      } catch {
        // corrupt/missing storage — fall back to defaults, already set
      } finally {
        loadedOnce.current = true;
        setReady(true);
      }
    })();
  }, []);

  // Debounced rather than immediate: `state` changes on every single cell
  // crossed while dragging, and JSON.stringify-ing the whole persisted shape
  // (every level ever generated, kept forever -- see PersistedShape above)
  // on every one of those is real JS-thread work stacking up mid-gesture.
  // Trailing-debouncing means the stringify+write only runs once the finger
  // actually pauses or lifts, never while it's still moving.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!loadedOnce.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stateRef.current)).catch(() => {});
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state]);

  const levelFor = useCallback((levelIndex: number): BlockFillLevel | undefined => state.generatedLevels[levelIndex], [state]);

  const ensureLevel = useCallback((levelIndex: number): void => {
    const current = stateRef.current;
    if (current.generatedLevels[levelIndex]) return;

    const level = createLevelForIndexRobust(levelIndex, current.skillRating, current.recentFingerprints);
    const next: PersistedShape = {
      ...current,
      generatedLevels: { ...current.generatedLevels, [levelIndex]: level },
      pathsByLevel: { ...current.pathsByLevel, [levelIndex]: [level.start] },
    };
    stateRef.current = next;
    setState(next);
  }, []);

  // Always keep one level ready ahead of the player rather than only
  // generating on demand -- same rationale as Matching Numbers.
  useEffect(() => {
    if (ready) ensureLevel(0);
  }, [ready, ensureLevel]);

  const extend = useCallback((levelIndex: number, cell: Cell): boolean => {
    const current = stateRef.current;
    const level = current.generatedLevels[levelIndex];
    const path = current.pathsByLevel[levelIndex];
    if (!level || !path) return false;
    const nextPath = extendPath(level, path, cell);
    if (!nextPath) return false;
    const next: PersistedShape = { ...current, pathsByLevel: { ...current.pathsByLevel, [levelIndex]: nextPath } };
    stateRef.current = next;
    setState(next);
    return true;
  }, []);

  const rewind = useCallback((levelIndex: number, cell: Cell): boolean => {
    const current = stateRef.current;
    const path = current.pathsByLevel[levelIndex];
    if (!path) return false;
    const nextPath = rewindTo(path, cell);
    if (!nextPath) return false;
    const next: PersistedShape = { ...current, pathsByLevel: { ...current.pathsByLevel, [levelIndex]: nextPath } };
    stateRef.current = next;
    setState(next);
    return true;
  }, []);

  const giveHint = useCallback((levelIndex: number): Cell | null => {
    const current = stateRef.current;
    const level = current.generatedLevels[levelIndex];
    const path = current.pathsByLevel[levelIndex];
    if (!level || !path) return null;
    const cell = findHintCell(level, path);
    if (!cell) return null;

    const next: PersistedShape = {
      ...current,
      hintsUsedByLevel: { ...current.hintsUsedByLevel, [levelIndex]: (current.hintsUsedByLevel[levelIndex] ?? 0) + 1 },
    };
    stateRef.current = next;
    setState(next);
    return cell;
  }, []);

  const resetLevel = useCallback((levelIndex: number) => {
    const current = stateRef.current;
    const level = current.generatedLevels[levelIndex];
    if (!level) return;
    const next: PersistedShape = {
      ...current,
      pathsByLevel: { ...current.pathsByLevel, [levelIndex]: [level.start] },
      hintsUsedByLevel: { ...current.hintsUsedByLevel, [levelIndex]: 0 },
    };
    stateRef.current = next;
    setState(next);
  }, []);

  const markLevelComplete = useCallback((levelIndex: number) => {
    const current = stateRef.current;
    if (current.levelsCompleted.includes(levelIndex)) return;
    const hintsUsed = current.hintsUsedByLevel[levelIndex] ?? 0;
    const next: PersistedShape = {
      ...current,
      levelsCompleted: current.levelsCompleted.concat(levelIndex),
      skillRating: nextSkillRating(current.skillRating, { hintsUsed, skipped: false }),
    };
    stateRef.current = next;
    setState(next);
  }, []);

  /** Marks a level skipped (via ad) so the next level unlocks -- distinct from actually solving it. */
  const markLevelSkipped = useCallback((levelIndex: number) => {
    const current = stateRef.current;
    if (current.levelsCompleted.includes(levelIndex) || current.levelsSkipped.includes(levelIndex)) return;
    const next: PersistedShape = {
      ...current,
      levelsSkipped: current.levelsSkipped.concat(levelIndex),
      skillRating: nextSkillRating(current.skillRating, { hintsUsed: 0, skipped: true }),
    };
    stateRef.current = next;
    setState(next);
  }, []);

  const markTutorialSeen = useCallback((key: string) => {
    const current = stateRef.current;
    if (current.tutorialsSeen.includes(key)) return;
    const next: PersistedShape = { ...current, tutorialsSeen: current.tutorialsSeen.concat(key) };
    stateRef.current = next;
    setState(next);
  }, []);

  const resetAllProgress = useCallback(() => {
    const next = defaultState();
    stateRef.current = next;
    setState(next);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  const value = useMemo<BlockFillProgressContextValue>(
    () => ({
      ready,
      levelFor,
      ensureLevel,
      pathsByLevel: state.pathsByLevel,
      levelsCompleted: new Set(state.levelsCompleted),
      levelsSkipped: new Set(state.levelsSkipped),
      tutorialsSeen: new Set(state.tutorialsSeen),
      skillRating: state.skillRating,
      extend,
      rewind,
      giveHint,
      resetLevel,
      markLevelComplete,
      markLevelSkipped,
      markTutorialSeen,
      resetAllProgress,
    }),
    [
      ready,
      state,
      levelFor,
      ensureLevel,
      extend,
      rewind,
      giveHint,
      resetLevel,
      markLevelComplete,
      markLevelSkipped,
      markTutorialSeen,
      resetAllProgress,
    ]
  );

  return React.createElement(BlockFillProgressContext.Provider, { value }, children);
}

export function useBlockFillProgress(): BlockFillProgressContextValue {
  const ctx = useContext(BlockFillProgressContext);
  if (!ctx) throw new Error('useBlockFillProgress must be used within a BlockFillProgressProvider');
  return ctx;
}
