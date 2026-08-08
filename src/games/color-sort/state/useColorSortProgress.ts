import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { findBestMove } from '../engine';
import { createLevelForIndexRobust, fingerprintColorSort, INITIAL_SKILL_RATING, nextSkillRating, pourMove, type Move, type SkillRating } from '../generation';
import type { ColorSortLevel, Tube } from '../types';

const STORAGE_KEY = '@signal-arcade/color-sort/progress/v1';
/** Bounds the shape-dedup history so it can't grow unbounded over 1000+ levels. */
const MAX_RECENT_FINGERPRINTS = 50;

interface PersistedShape {
  /** Every level a player has reached is generated once and kept forever --
   * replaying an old level must show the same puzzle even after skill rating
   * has moved on. Keyed by level index. */
  generatedLevels: Record<number, ColorSortLevel>;
  /** The live in-progress arrangement -- separate from generatedLevels[idx].tubes so play can resume mid-solve. */
  tubesByLevel: Record<number, Tube[]>;
  moveCountByLevel: Record<number, number>;
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
    tubesByLevel: {},
    moveCountByLevel: {},
    levelsCompleted: [],
    levelsSkipped: [],
    tutorialsSeen: [],
    skillRating: INITIAL_SKILL_RATING,
    recentFingerprints: [],
    hintsUsedByLevel: {},
  };
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

function sanitizePersisted(parsed: Partial<PersistedShape> | null): PersistedShape {
  if (!parsed) return defaultState();

  const generatedLevels: Record<number, ColorSortLevel> = {};
  const tubesByLevel: Record<number, Tube[]> = {};
  const rawTubes = (parsed.tubesByLevel ?? {}) as Record<string, unknown>;
  const rawMoveCount = (parsed.moveCountByLevel ?? {}) as Record<string, unknown>;
  const moveCountByLevel: Record<number, number> = {};

  for (const [key, level] of Object.entries(parsed.generatedLevels ?? {})) {
    if (!isValidLevel(level)) continue;
    const idx = Number(key);
    generatedLevels[idx] = level;
    tubesByLevel[idx] = sanitizeTubes(rawTubes[key], level);
    moveCountByLevel[idx] = typeof rawMoveCount[key] === 'number' ? (rawMoveCount[key] as number) : 0;
  }

  return {
    generatedLevels,
    tubesByLevel,
    moveCountByLevel,
    levelsCompleted: Array.isArray(parsed.levelsCompleted) ? parsed.levelsCompleted : [],
    levelsSkipped: Array.isArray(parsed.levelsSkipped) ? parsed.levelsSkipped : [],
    tutorialsSeen: Array.isArray(parsed.tutorialsSeen) ? parsed.tutorialsSeen : [],
    skillRating: typeof parsed.skillRating === 'number' ? parsed.skillRating : INITIAL_SKILL_RATING,
    recentFingerprints: Array.isArray(parsed.recentFingerprints) ? parsed.recentFingerprints.slice(-MAX_RECENT_FINGERPRINTS) : [],
    hintsUsedByLevel:
      parsed.hintsUsedByLevel && typeof parsed.hintsUsedByLevel === 'object' ? (parsed.hintsUsedByLevel as Record<number, number>) : {},
  };
}

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
}

const ColorSortProgressContext = createContext<ColorSortProgressContextValue | null>(null);

export function ColorSortProgressProvider({ children }: { children: React.ReactNode }) {
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

  useEffect(() => {
    if (!loadedOnce.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state]);

  const levelFor = useCallback((levelIndex: number): ColorSortLevel | undefined => state.generatedLevels[levelIndex], [state]);

  const ensureLevel = useCallback((levelIndex: number): void => {
    const current = stateRef.current;
    if (current.generatedLevels[levelIndex]) return;

    const level = createLevelForIndexRobust(levelIndex, current.skillRating, current.recentFingerprints);
    const fingerprint = fingerprintColorSort(level.tubes, level.capacity);
    const next: PersistedShape = {
      ...current,
      generatedLevels: { ...current.generatedLevels, [levelIndex]: level },
      tubesByLevel: { ...current.tubesByLevel, [levelIndex]: level.tubes.map((t) => t.slice()) },
      moveCountByLevel: { ...current.moveCountByLevel, [levelIndex]: 0 },
      recentFingerprints: [...current.recentFingerprints, fingerprint].slice(-MAX_RECENT_FINGERPRINTS),
    };
    stateRef.current = next;
    setState(next);
  }, []);

  // Always keep one level ready ahead of the player rather than only
  // generating on demand -- same rationale as every other game.
  useEffect(() => {
    if (ready) ensureLevel(0);
  }, [ready, ensureLevel]);

  const pourAt = useCallback((levelIndex: number, from: number, to: number): boolean => {
    const current = stateRef.current;
    const level = current.generatedLevels[levelIndex];
    const tubes = current.tubesByLevel[levelIndex];
    if (!level || !tubes) return false;
    const result = pourMove(tubes, level.capacity, from, to);
    if (!result) return false;

    const next: PersistedShape = {
      ...current,
      tubesByLevel: { ...current.tubesByLevel, [levelIndex]: result.tubes },
      moveCountByLevel: { ...current.moveCountByLevel, [levelIndex]: (current.moveCountByLevel[levelIndex] ?? 0) + 1 },
    };
    stateRef.current = next;
    setState(next);
    return true;
  }, []);

  const giveHint = useCallback((levelIndex: number): Move | null => {
    const current = stateRef.current;
    const level = current.generatedLevels[levelIndex];
    const tubes = current.tubesByLevel[levelIndex];
    if (!level || !tubes) return null;
    const move = findBestMove(tubes, level.capacity);
    if (!move) return null;

    const next: PersistedShape = {
      ...current,
      hintsUsedByLevel: { ...current.hintsUsedByLevel, [levelIndex]: (current.hintsUsedByLevel[levelIndex] ?? 0) + 1 },
    };
    stateRef.current = next;
    setState(next);
    return move;
  }, []);

  const resetLevel = useCallback((levelIndex: number) => {
    const current = stateRef.current;
    const level = current.generatedLevels[levelIndex];
    if (!level) return;
    const next: PersistedShape = {
      ...current,
      tubesByLevel: { ...current.tubesByLevel, [levelIndex]: level.tubes.map((t) => t.slice()) },
      moveCountByLevel: { ...current.moveCountByLevel, [levelIndex]: 0 },
      hintsUsedByLevel: { ...current.hintsUsedByLevel, [levelIndex]: 0 },
    };
    stateRef.current = next;
    setState(next);
  }, []);

  const undoMove = useCallback((levelIndex: number, tubes: Tube[]) => {
    const current = stateRef.current;
    if (!current.generatedLevels[levelIndex]) return;
    const next: PersistedShape = {
      ...current,
      tubesByLevel: { ...current.tubesByLevel, [levelIndex]: tubes },
      moveCountByLevel: { ...current.moveCountByLevel, [levelIndex]: Math.max(0, (current.moveCountByLevel[levelIndex] ?? 0) - 1) },
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

  const value = useMemo<ColorSortProgressContextValue>(
    () => ({
      ready,
      levelFor,
      ensureLevel,
      tubesByLevel: state.tubesByLevel,
      moveCountByLevel: state.moveCountByLevel,
      levelsCompleted: new Set(state.levelsCompleted),
      levelsSkipped: new Set(state.levelsSkipped),
      tutorialsSeen: new Set(state.tutorialsSeen),
      skillRating: state.skillRating,
      pourAt,
      giveHint,
      resetLevel,
      undoMove,
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
      pourAt,
      giveHint,
      resetLevel,
      undoMove,
      markLevelComplete,
      markLevelSkipped,
      markTutorialSeen,
      resetAllProgress,
    ]
  );

  return React.createElement(ColorSortProgressContext.Provider, { value }, children);
}

export function useColorSortProgress(): ColorSortProgressContextValue {
  const ctx = useContext(ColorSortProgressContext);
  if (!ctx) throw new Error('useColorSortProgress must be used within a ColorSortProgressProvider');
  return ctx;
}
