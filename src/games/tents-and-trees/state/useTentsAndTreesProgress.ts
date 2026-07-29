import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { applyHint, makeInitialTents, toggleTent } from '../engine';
import {
  createLevelForIndexRobust,
  fingerprintTentsAndTrees,
  INITIAL_SKILL_RATING,
  nextSkillRating,
  type SkillRating,
} from '../generation';
import type { TentsAndTreesLevel } from '../types';

// Bumped to v2: v1-era levels were generated before the pair-placement fix
// in generation/generator.ts (constructSolvedBoard) and can contain a tree
// or tent bordering more than one partner. Persisted levels are never
// regenerated once cached, so the version bump is what actually clears them.
const STORAGE_KEY = '@signal-arcade/tents-and-trees/progress/v2';
/** Bounds the shape-dedup history so it can't grow unbounded over 1000+ levels. */
const MAX_RECENT_FINGERPRINTS = 50;

interface PersistedShape {
  /** Every level a player has reached is generated once and kept forever --
   * replaying an old level must show the same puzzle even after skill rating
   * has moved on. */
  generatedLevels: Record<number, TentsAndTreesLevel>;
  tentsByLevel: Record<number, boolean[][]>;
  /** "r,c" keys revealed via Hint -- locked, can't be toggled back. */
  hintedCellsByLevel: Record<number, string[]>;
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
    tentsByLevel: {},
    hintedCellsByLevel: {},
    levelsCompleted: [],
    levelsSkipped: [],
    tutorialsSeen: [],
    skillRating: INITIAL_SKILL_RATING,
    recentFingerprints: [],
    hintsUsedByLevel: {},
  };
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

function sanitizePersisted(parsed: Partial<PersistedShape> | null): PersistedShape {
  if (!parsed) return defaultState();

  const generatedLevels: Record<number, TentsAndTreesLevel> = {};
  const tentsByLevel: Record<number, boolean[][]> = {};
  const hintedCellsByLevel: Record<number, string[]> = {};
  const rawTents = (parsed.tentsByLevel ?? {}) as Record<string, unknown>;
  const rawHinted = (parsed.hintedCellsByLevel ?? {}) as Record<string, unknown>;

  for (const [key, level] of Object.entries(parsed.generatedLevels ?? {})) {
    if (!isValidLevel(level)) continue;
    const idx = Number(key);
    generatedLevels[idx] = level;
    tentsByLevel[idx] = sanitizeTents(rawTents[key], level.rows, level.cols);
    hintedCellsByLevel[idx] = Array.isArray(rawHinted[key]) ? (rawHinted[key] as string[]) : [];
  }

  return {
    generatedLevels,
    tentsByLevel,
    hintedCellsByLevel,
    levelsCompleted: Array.isArray(parsed.levelsCompleted) ? parsed.levelsCompleted : [],
    levelsSkipped: Array.isArray(parsed.levelsSkipped) ? parsed.levelsSkipped : [],
    tutorialsSeen: Array.isArray(parsed.tutorialsSeen) ? parsed.tutorialsSeen : [],
    skillRating: typeof parsed.skillRating === 'number' ? parsed.skillRating : INITIAL_SKILL_RATING,
    recentFingerprints: Array.isArray(parsed.recentFingerprints) ? parsed.recentFingerprints.slice(-MAX_RECENT_FINGERPRINTS) : [],
    hintsUsedByLevel:
      parsed.hintsUsedByLevel && typeof parsed.hintsUsedByLevel === 'object' ? (parsed.hintsUsedByLevel as Record<number, number>) : {},
  };
}

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
}

const TentsAndTreesProgressContext = createContext<TentsAndTreesProgressContextValue | null>(null);

export function TentsAndTreesProgressProvider({ children }: { children: React.ReactNode }) {
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

  const levelFor = useCallback((levelIndex: number): TentsAndTreesLevel | undefined => state.generatedLevels[levelIndex], [state]);

  const ensureLevel = useCallback((levelIndex: number): void => {
    const current = stateRef.current;
    if (current.generatedLevels[levelIndex]) return;

    const level = createLevelForIndexRobust(levelIndex, current.skillRating, current.recentFingerprints);
    const fingerprint = fingerprintTentsAndTrees(level.trees, level.rowTargets, level.colTargets);
    const next: PersistedShape = {
      ...current,
      generatedLevels: { ...current.generatedLevels, [levelIndex]: level },
      tentsByLevel: { ...current.tentsByLevel, [levelIndex]: makeInitialTents(level.rows, level.cols) },
      hintedCellsByLevel: { ...current.hintedCellsByLevel, [levelIndex]: [] },
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

  const toggleTentAt = useCallback((levelIndex: number, r: number, c: number) => {
    const current = stateRef.current;
    const tents = current.tentsByLevel[levelIndex];
    if (!tents) return;
    const hinted = current.hintedCellsByLevel[levelIndex] ?? [];
    if (hinted.includes(`${r},${c}`)) return;

    const nextTents = toggleTent(tents, r, c);
    const next: PersistedShape = { ...current, tentsByLevel: { ...current.tentsByLevel, [levelIndex]: nextTents } };
    stateRef.current = next;
    setState(next);
  }, []);

  /** Reveals one currently-wrong cell and locks it. Returns false if the level has no hint left to give. */
  const giveHint = useCallback((levelIndex: number): boolean => {
    const current = stateRef.current;
    const level = current.generatedLevels[levelIndex];
    const tents = current.tentsByLevel[levelIndex];
    if (!level || !tents) return false;
    const result = applyHint(level, tents);
    if (!result) return false;

    const hinted = current.hintedCellsByLevel[levelIndex] ?? [];
    const next: PersistedShape = {
      ...current,
      tentsByLevel: { ...current.tentsByLevel, [levelIndex]: result.tents },
      hintedCellsByLevel: { ...current.hintedCellsByLevel, [levelIndex]: hinted.concat(`${result.r},${result.c}`) },
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
      tentsByLevel: { ...current.tentsByLevel, [levelIndex]: makeInitialTents(level.rows, level.cols) },
      hintedCellsByLevel: { ...current.hintedCellsByLevel, [levelIndex]: [] },
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

  const hintedCellsByLevel = useMemo(() => {
    const out: Record<number, Set<string>> = {};
    for (const [key, cells] of Object.entries(state.hintedCellsByLevel)) out[Number(key)] = new Set(cells);
    return out;
  }, [state.hintedCellsByLevel]);

  const value = useMemo<TentsAndTreesProgressContextValue>(
    () => ({
      ready,
      levelFor,
      ensureLevel,
      tentsByLevel: state.tentsByLevel,
      hintedCellsByLevel,
      levelsCompleted: new Set(state.levelsCompleted),
      levelsSkipped: new Set(state.levelsSkipped),
      tutorialsSeen: new Set(state.tutorialsSeen),
      skillRating: state.skillRating,
      toggleTentAt,
      giveHint,
      resetLevel,
      markLevelComplete,
      markLevelSkipped,
      markTutorialSeen,
    }),
    [
      ready,
      state,
      hintedCellsByLevel,
      levelFor,
      ensureLevel,
      toggleTentAt,
      giveHint,
      resetLevel,
      markLevelComplete,
      markLevelSkipped,
      markTutorialSeen,
    ]
  );

  return React.createElement(TentsAndTreesProgressContext.Provider, { value }, children);
}

export function useTentsAndTreesProgress(): TentsAndTreesProgressContextValue {
  const ctx = useContext(TentsAndTreesProgressContext);
  if (!ctx) throw new Error('useTentsAndTreesProgress must be used within a TentsAndTreesProgressProvider');
  return ctx;
}
