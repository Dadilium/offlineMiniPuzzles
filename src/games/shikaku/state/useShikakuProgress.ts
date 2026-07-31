import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { applyHint, clueIndicesIn, containsCell, placeRect, removeRectAt } from '../engine';
import {
  createLevelForIndexRobust,
  fingerprintShikaku,
  INITIAL_SKILL_RATING,
  nextSkillRating,
  type SkillRating,
} from '../generation';
import type { RectBounds, ShikakuLevel, ShikakuPlayerState } from '../types';

const STORAGE_KEY = '@signal-arcade/shikaku/progress/v1';
/** Bounds the shape-dedup history so it can't grow unbounded over 1000+ levels. */
const MAX_RECENT_FINGERPRINTS = 50;
/**
 * Sanity ceiling on how many per-level entries a real player could ever
 * legitimately reach -- generously above any realistic session, purely to
 * detect a corrupted/runaway-grown persisted blob (e.g. from a since-fixed
 * bug) rather than faithfully reloading and re-persisting it forever. A
 * `Record` with anywhere near this many keys is what trips Hermes's
 * "Property storage exceeds N properties" engine limit, which otherwise
 * throws synchronously and uncaught from the persistence effect below.
 */
const MAX_GENERATED_LEVELS = 5000;

interface PersistedShape {
  /** Every level a player has reached is generated once and kept forever --
   * replaying an old level must show the same puzzle even after skill rating
   * has moved on. */
  generatedLevels: Record<number, ShikakuLevel>;
  placedByLevel: Record<number, ShikakuPlayerState>;
  /** Clue indices revealed via Hint -- locked, their rectangle can't be redrawn or deleted. */
  hintedClueIndicesByLevel: Record<number, number[]>;
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
    placedByLevel: {},
    hintedClueIndicesByLevel: {},
    levelsCompleted: [],
    levelsSkipped: [],
    tutorialsSeen: [],
    skillRating: INITIAL_SKILL_RATING,
    recentFingerprints: [],
    hintsUsedByLevel: {},
  };
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

function sanitizePersisted(parsed: Partial<PersistedShape> | null): PersistedShape {
  if (!parsed) return defaultState();

  // A legitimately-reached level count anywhere near this is not something
  // real play produces -- treat it as corrupted/runaway-grown data and
  // self-heal to a clean slate rather than faithfully reloading (and then
  // re-persisting, via `JSON.stringify` below) an oversized object on every
  // launch.
  const rawGeneratedLevels = parsed.generatedLevels;
  if (rawGeneratedLevels && Object.keys(rawGeneratedLevels).length > MAX_GENERATED_LEVELS) {
    return defaultState();
  }

  const generatedLevels: Record<number, ShikakuLevel> = {};
  const placedByLevel: Record<number, ShikakuPlayerState> = {};
  const hintedClueIndicesByLevel: Record<number, number[]> = {};
  const rawPlaced = (parsed.placedByLevel ?? {}) as Record<string, unknown>;
  const rawHinted = (parsed.hintedClueIndicesByLevel ?? {}) as Record<string, unknown>;

  for (const [key, level] of Object.entries(parsed.generatedLevels ?? {})) {
    if (!isValidLevel(level)) continue;
    const idx = Number(key);
    generatedLevels[idx] = level;
    placedByLevel[idx] = sanitizePlaced(rawPlaced[key]);
    hintedClueIndicesByLevel[idx] = Array.isArray(rawHinted[key]) ? (rawHinted[key] as number[]) : [];
  }

  return {
    generatedLevels,
    placedByLevel,
    hintedClueIndicesByLevel,
    levelsCompleted: Array.isArray(parsed.levelsCompleted) ? parsed.levelsCompleted : [],
    levelsSkipped: Array.isArray(parsed.levelsSkipped) ? parsed.levelsSkipped : [],
    tutorialsSeen: Array.isArray(parsed.tutorialsSeen) ? parsed.tutorialsSeen : [],
    skillRating: typeof parsed.skillRating === 'number' ? parsed.skillRating : INITIAL_SKILL_RATING,
    recentFingerprints: Array.isArray(parsed.recentFingerprints) ? parsed.recentFingerprints.slice(-MAX_RECENT_FINGERPRINTS) : [],
    hintsUsedByLevel:
      parsed.hintsUsedByLevel && typeof parsed.hintsUsedByLevel === 'object' ? (parsed.hintsUsedByLevel as Record<number, number>) : {},
  };
}

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

const ShikakuProgressContext = createContext<ShikakuProgressContextValue | null>(null);

export function ShikakuProgressProvider({ children }: { children: React.ReactNode }) {
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
    // `JSON.stringify` itself can throw synchronously (e.g. if `state` ever
    // ballooned past an engine's property-storage limit) -- the `.catch`
    // below only guards the async `AsyncStorage.setItem` promise, so a
    // stringify failure needs its own guard or it escapes this effect
    // uncaught.
    let serialized: string;
    try {
      serialized = JSON.stringify(state);
    } catch {
      return;
    }
    AsyncStorage.setItem(STORAGE_KEY, serialized).catch(() => {});
  }, [state]);

  const levelFor = useCallback((levelIndex: number): ShikakuLevel | undefined => state.generatedLevels[levelIndex], [state]);

  const ensureLevel = useCallback((levelIndex: number): void => {
    const current = stateRef.current;
    if (current.generatedLevels[levelIndex]) return;

    const level = createLevelForIndexRobust(levelIndex, current.skillRating, current.recentFingerprints);
    const fingerprint = fingerprintShikaku(level.rows, level.cols, level.clues);
    const next: PersistedShape = {
      ...current,
      generatedLevels: { ...current.generatedLevels, [levelIndex]: level },
      placedByLevel: { ...current.placedByLevel, [levelIndex]: [] },
      hintedClueIndicesByLevel: { ...current.hintedClueIndicesByLevel, [levelIndex]: [] },
      recentFingerprints: [...current.recentFingerprints, fingerprint].slice(-MAX_RECENT_FINGERPRINTS),
    };
    stateRef.current = next;
    setState(next);
  }, []);

  // Always keep one level ready ahead of the player rather than only
  // generating on demand: as soon as the app has loaded progress, make sure
  // the very first level exists.
  useEffect(() => {
    if (ready) ensureLevel(0);
  }, [ready, ensureLevel]);

  const commitRectAt = useCallback((levelIndex: number, candidate: RectBounds) => {
    const current = stateRef.current;
    const level = current.generatedLevels[levelIndex];
    const placed = current.placedByLevel[levelIndex];
    if (!level || !placed) return;

    const hinted = current.hintedClueIndicesByLevel[levelIndex] ?? [];
    const targetClueIndices = clueIndicesIn(level.clues, candidate);
    if (targetClueIndices.length === 1 && hinted.includes(targetClueIndices[0])) return;

    const result = placeRect(level, placed, candidate);
    if ('error' in result) return;

    const next: PersistedShape = { ...current, placedByLevel: { ...current.placedByLevel, [levelIndex]: result.placedRects } };
    stateRef.current = next;
    setState(next);
  }, []);

  const tapCellAt = useCallback((levelIndex: number, r: number, c: number) => {
    const current = stateRef.current;
    const placed = current.placedByLevel[levelIndex];
    if (!placed) return;

    const covering = placed.find((rect) => containsCell(rect, r, c));
    if (!covering) return;

    const hinted = current.hintedClueIndicesByLevel[levelIndex] ?? [];
    if (hinted.includes(covering.clueIndex)) return;

    const nextPlaced = removeRectAt(placed, r, c);
    const next: PersistedShape = { ...current, placedByLevel: { ...current.placedByLevel, [levelIndex]: nextPlaced } };
    stateRef.current = next;
    setState(next);
  }, []);

  /** Reveals one currently-wrong (or unplaced) clue's correct rectangle and locks it. Returns false if every clue already matches the solution. */
  const giveHint = useCallback((levelIndex: number): boolean => {
    const current = stateRef.current;
    const level = current.generatedLevels[levelIndex];
    const placed = current.placedByLevel[levelIndex];
    if (!level || !placed) return false;
    const result = applyHint(level, placed);
    if (!result) return false;

    const hinted = current.hintedClueIndicesByLevel[levelIndex] ?? [];
    const nextHinted = hinted.includes(result.clueIndex) ? hinted : hinted.concat(result.clueIndex);
    const next: PersistedShape = {
      ...current,
      placedByLevel: { ...current.placedByLevel, [levelIndex]: result.placedRects },
      hintedClueIndicesByLevel: { ...current.hintedClueIndicesByLevel, [levelIndex]: nextHinted },
      hintsUsedByLevel: { ...current.hintsUsedByLevel, [levelIndex]: (current.hintsUsedByLevel[levelIndex] ?? 0) + 1 },
    };
    stateRef.current = next;
    setState(next);
    return true;
  }, []);

  const resetLevel = useCallback((levelIndex: number) => {
    const current = stateRef.current;
    const level = current.generatedLevels[levelIndex];
    if (!level) return;
    const next: PersistedShape = {
      ...current,
      placedByLevel: { ...current.placedByLevel, [levelIndex]: [] },
      hintedClueIndicesByLevel: { ...current.hintedClueIndicesByLevel, [levelIndex]: [] },
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

  const hintedClueIndicesByLevel = useMemo(() => {
    const out: Record<number, Set<number>> = {};
    for (const [key, indices] of Object.entries(state.hintedClueIndicesByLevel)) out[Number(key)] = new Set(indices);
    return out;
  }, [state.hintedClueIndicesByLevel]);

  const resetAllProgress = useCallback(() => {
    const next = defaultState();
    stateRef.current = next;
    setState(next);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  const value = useMemo<ShikakuProgressContextValue>(
    () => ({
      ready,
      levelFor,
      ensureLevel,
      placedByLevel: state.placedByLevel,
      hintedClueIndicesByLevel,
      levelsCompleted: new Set(state.levelsCompleted),
      levelsSkipped: new Set(state.levelsSkipped),
      tutorialsSeen: new Set(state.tutorialsSeen),
      skillRating: state.skillRating,
      commitRectAt,
      tapCellAt,
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
      hintedClueIndicesByLevel,
      levelFor,
      ensureLevel,
      commitRectAt,
      tapCellAt,
      giveHint,
      resetLevel,
      markLevelComplete,
      markLevelSkipped,
      markTutorialSeen,
      resetAllProgress,
    ]
  );

  return React.createElement(ShikakuProgressContext.Provider, { value }, children);
}

export function useShikakuProgress(): ShikakuProgressContextValue {
  const ctx = useContext(ShikakuProgressContext);
  if (!ctx) throw new Error('useShikakuProgress must be used within a ShikakuProgressProvider');
  return ctx;
}
