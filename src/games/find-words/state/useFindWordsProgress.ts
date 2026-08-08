import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import i18n from '../../../i18n';
import { matchPlacement } from '../engine';
import {
  createLevelForIndexRobust,
  fingerprintFindWords,
  INITIAL_SKILL_RATING,
  nextSkillRating,
  type SkillRating,
  type WordBankLanguage,
} from '../generation';
import type { Cell, FindWordsLevel } from '../types';

const STORAGE_KEY = '@signal-arcade/find-words/progress/v1';
/** Bounds the shape-dedup history so it can't grow unbounded over 1000+ levels. */
const MAX_RECENT_FINGERPRINTS = 50;
/**
 * Sanity ceiling on how many per-level entries a real player could ever
 * legitimately reach -- see useShikakuProgress.ts's identical guard for why
 * this self-heals rather than faithfully reloading (and re-persisting) a
 * corrupted/runaway-grown blob.
 */
const MAX_GENERATED_LEVELS = 5000;

/** App language and the word bank language are the same 'en'/'fr' set, so no mapping is needed -- just a defensive default for any value outside that set. */
function currentLanguage(): WordBankLanguage {
  return i18n.language === 'fr' ? 'fr' : 'en';
}

interface PersistedShape {
  /** Every level a player has reached is generated once and kept forever --
   * replaying an old level must show the same puzzle even after skill rating
   * or app language has since moved on. */
  generatedLevels: Record<number, FindWordsLevel>;
  foundIndicesByLevel: Record<number, number[]>;
  levelsCompleted: number[];
  levelsSkipped: number[];
  tutorialsSeen: string[];
  skillRating: SkillRating;
  recentFingerprints: string[];
}

function defaultState(): PersistedShape {
  return {
    generatedLevels: {},
    foundIndicesByLevel: {},
    levelsCompleted: [],
    levelsSkipped: [],
    tutorialsSeen: [],
    skillRating: INITIAL_SKILL_RATING,
    recentFingerprints: [],
  };
}

function isValidLevel(level: unknown): level is FindWordsLevel {
  const l = level as FindWordsLevel | null;
  return !!l && typeof l.rows === 'number' && typeof l.cols === 'number' && Array.isArray(l.grid) && Array.isArray(l.placements);
}

function sanitizeFoundIndices(found: unknown): number[] {
  if (!Array.isArray(found)) return [];
  return found.filter((i): i is number => typeof i === 'number');
}

function sanitizePersisted(parsed: Partial<PersistedShape> | null): PersistedShape {
  if (!parsed) return defaultState();

  const rawGeneratedLevels = parsed.generatedLevels;
  if (rawGeneratedLevels && Object.keys(rawGeneratedLevels).length > MAX_GENERATED_LEVELS) {
    return defaultState();
  }

  const generatedLevels: Record<number, FindWordsLevel> = {};
  const foundIndicesByLevel: Record<number, number[]> = {};
  const rawFound = (parsed.foundIndicesByLevel ?? {}) as Record<string, unknown>;

  for (const [key, level] of Object.entries(parsed.generatedLevels ?? {})) {
    if (!isValidLevel(level)) continue;
    const idx = Number(key);
    generatedLevels[idx] = level;
    foundIndicesByLevel[idx] = sanitizeFoundIndices(rawFound[key]);
  }

  return {
    generatedLevels,
    foundIndicesByLevel,
    levelsCompleted: Array.isArray(parsed.levelsCompleted) ? parsed.levelsCompleted : [],
    levelsSkipped: Array.isArray(parsed.levelsSkipped) ? parsed.levelsSkipped : [],
    tutorialsSeen: Array.isArray(parsed.tutorialsSeen) ? parsed.tutorialsSeen : [],
    skillRating: typeof parsed.skillRating === 'number' ? parsed.skillRating : INITIAL_SKILL_RATING,
    recentFingerprints: Array.isArray(parsed.recentFingerprints) ? parsed.recentFingerprints.slice(-MAX_RECENT_FINGERPRINTS) : [],
  };
}

interface FindWordsProgressContextValue {
  ready: boolean;
  /** Pure lookup -- undefined until `ensureLevel` has generated this index. */
  levelFor: (levelIndex: number) => FindWordsLevel | undefined;
  /** Generates (and persists) a level for this index if missing, in the
   * player's current app language. This may update provider state, so call
   * it from an effect or event handler -- never from a render body. Safe to
   * call speculatively ahead of need (e.g. to prefetch the next level)
   * since it's a no-op once a level has already been generated for that
   * index. */
  ensureLevel: (levelIndex: number) => void;
  foundIndicesByLevel: Record<number, number[]>;
  levelsCompleted: Set<number>;
  levelsSkipped: Set<number>;
  tutorialsSeen: Set<string>;
  skillRating: SkillRating;
  /** Checks `cells` against every not-yet-found placement (in either drag
   * direction) and, on a match, marks it found. Returns the matched
   * placement index, or null if nothing matched (no state change). */
  attemptWord: (levelIndex: number, cells: Cell[]) => number | null;
  resetLevel: (levelIndex: number) => void;
  markLevelComplete: (levelIndex: number) => void;
  markLevelSkipped: (levelIndex: number) => void;
  markTutorialSeen: (key: string) => void;
  /** Wipes all generated levels, found words, and completion/skip/tutorial state -- for the Settings > Game Progress reset. */
  resetAllProgress: () => void;
}

const FindWordsProgressContext = createContext<FindWordsProgressContextValue | null>(null);

export function FindWordsProgressProvider({ children }: { children: React.ReactNode }) {
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
    let serialized: string;
    try {
      serialized = JSON.stringify(state);
    } catch {
      return;
    }
    AsyncStorage.setItem(STORAGE_KEY, serialized).catch(() => {});
  }, [state]);

  const levelFor = useCallback((levelIndex: number): FindWordsLevel | undefined => state.generatedLevels[levelIndex], [state]);

  const ensureLevel = useCallback((levelIndex: number): void => {
    const current = stateRef.current;
    if (current.generatedLevels[levelIndex]) return;

    const level = createLevelForIndexRobust(levelIndex, current.skillRating, currentLanguage(), current.recentFingerprints);
    const fingerprint = fingerprintFindWords(level.rows, level.cols, level.placements);
    const next: PersistedShape = {
      ...current,
      generatedLevels: { ...current.generatedLevels, [levelIndex]: level },
      foundIndicesByLevel: { ...current.foundIndicesByLevel, [levelIndex]: [] },
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

  const attemptWord = useCallback((levelIndex: number, cells: Cell[]): number | null => {
    const current = stateRef.current;
    const level = current.generatedLevels[levelIndex];
    if (!level) return null;
    const found = current.foundIndicesByLevel[levelIndex] ?? [];

    const matched = matchPlacement(level, cells, found);
    if (matched === null) return null;

    const next: PersistedShape = {
      ...current,
      foundIndicesByLevel: { ...current.foundIndicesByLevel, [levelIndex]: [...found, matched] },
    };
    stateRef.current = next;
    setState(next);
    return matched;
  }, []);

  const resetLevel = useCallback((levelIndex: number) => {
    const current = stateRef.current;
    if (!current.generatedLevels[levelIndex]) return;
    const next: PersistedShape = { ...current, foundIndicesByLevel: { ...current.foundIndicesByLevel, [levelIndex]: [] } };
    stateRef.current = next;
    setState(next);
  }, []);

  const markLevelComplete = useCallback((levelIndex: number) => {
    const current = stateRef.current;
    if (current.levelsCompleted.includes(levelIndex)) return;
    const next: PersistedShape = {
      ...current,
      levelsCompleted: current.levelsCompleted.concat(levelIndex),
      skillRating: nextSkillRating(current.skillRating, { skipped: false }),
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
      skillRating: nextSkillRating(current.skillRating, { skipped: true }),
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

  const value = useMemo<FindWordsProgressContextValue>(
    () => ({
      ready,
      levelFor,
      ensureLevel,
      foundIndicesByLevel: state.foundIndicesByLevel,
      levelsCompleted: new Set(state.levelsCompleted),
      levelsSkipped: new Set(state.levelsSkipped),
      tutorialsSeen: new Set(state.tutorialsSeen),
      skillRating: state.skillRating,
      attemptWord,
      resetLevel,
      markLevelComplete,
      markLevelSkipped,
      markTutorialSeen,
      resetAllProgress,
    }),
    [ready, state, levelFor, ensureLevel, attemptWord, resetLevel, markLevelComplete, markLevelSkipped, markTutorialSeen, resetAllProgress]
  );

  return React.createElement(FindWordsProgressContext.Provider, { value }, children);
}

export function useFindWordsProgress(): FindWordsProgressContextValue {
  const ctx = useContext(FindWordsProgressContext);
  if (!ctx) throw new Error('useFindWordsProgress must be used within a FindWordsProgressProvider');
  return ctx;
}
