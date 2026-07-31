import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { applyHint, cycleCellState, makeEmptyBoard } from '../engine';
import { createLevelForIndexRobust, fingerprintRegions, INITIAL_SKILL_RATING, nextSkillRating, type SkillRating } from '../generation';
import type { CellState, KingsLevel } from '../types';

const STORAGE_KEY = '@signal-arcade/kings/progress/v2';
/** Bounds the shape-dedup history so it can't grow unbounded over 1000+ levels. */
const MAX_RECENT_FINGERPRINTS = 50;

interface PersistedShape {
  /** Every level a player has reached is generated once and kept forever --
   * replaying an old level must show the same puzzle even after skill rating
   * has moved on. Keyed by level index; footprint is trivial (a level is
   * ~200-350 bytes as JSON), so there's no need to evict old entries. */
  generatedLevels: Record<number, KingsLevel>;
  boardsByLevel: Record<number, CellState[][]>;
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
    boardsByLevel: {},
    levelsCompleted: [],
    levelsSkipped: [],
    tutorialsSeen: [],
    skillRating: INITIAL_SKILL_RATING,
    recentFingerprints: [],
    hintsUsedByLevel: {},
  };
}

function isValidLevel(level: unknown): level is KingsLevel {
  const l = level as KingsLevel | null;
  return !!l && typeof l.n === 'number' && Array.isArray(l.regions) && Array.isArray(l.solution);
}

/** Guards against a corrupt/stale board shape. */
function sanitizeBoard(board: unknown, n: number): CellState[][] {
  if (!Array.isArray(board) || board.length !== n) return makeEmptyBoard(n);
  for (const row of board) {
    if (!Array.isArray(row) || row.length !== n) return makeEmptyBoard(n);
  }
  return board as CellState[][];
}

function sanitizePersisted(parsed: Partial<PersistedShape> | null): PersistedShape {
  if (!parsed) return defaultState();

  const generatedLevels: Record<number, KingsLevel> = {};
  const boardsByLevel: Record<number, CellState[][]> = {};
  const rawBoards = (parsed.boardsByLevel ?? {}) as Record<string, unknown>;

  for (const [key, level] of Object.entries(parsed.generatedLevels ?? {})) {
    if (!isValidLevel(level)) continue;
    const idx = Number(key);
    generatedLevels[idx] = level;
    boardsByLevel[idx] = sanitizeBoard(rawBoards[key], level.n);
  }

  return {
    generatedLevels,
    boardsByLevel,
    levelsCompleted: Array.isArray(parsed.levelsCompleted) ? parsed.levelsCompleted : [],
    levelsSkipped: Array.isArray(parsed.levelsSkipped) ? parsed.levelsSkipped : [],
    tutorialsSeen: Array.isArray(parsed.tutorialsSeen) ? parsed.tutorialsSeen : [],
    skillRating: typeof parsed.skillRating === 'number' ? parsed.skillRating : INITIAL_SKILL_RATING,
    recentFingerprints: Array.isArray(parsed.recentFingerprints) ? parsed.recentFingerprints.slice(-MAX_RECENT_FINGERPRINTS) : [],
    hintsUsedByLevel:
      parsed.hintsUsedByLevel && typeof parsed.hintsUsedByLevel === 'object' ? (parsed.hintsUsedByLevel as Record<number, number>) : {},
  };
}

interface KingsProgressContextValue {
  ready: boolean;
  /** Pure lookup -- undefined until `ensureLevel` has generated this index. */
  levelFor: (levelIndex: number) => KingsLevel | undefined;
  /** Generates (and persists) a level for this index if missing. This may
   * update provider state, so call it from an effect or event handler --
   * never from a render body. Safe to call speculatively ahead of need
   * (e.g. to prefetch the next level) since it's a no-op once a level has
   * already been generated for that index. */
  ensureLevel: (levelIndex: number) => void;
  boardsByLevel: Record<number, CellState[][]>;
  levelsCompleted: Set<number>;
  levelsSkipped: Set<number>;
  tutorialsSeen: Set<string>;
  skillRating: SkillRating;
  cycleCell: (levelIndex: number, r: number, c: number) => void;
  giveHint: (levelIndex: number) => boolean;
  resetLevel: (levelIndex: number) => void;
  markLevelComplete: (levelIndex: number) => void;
  markLevelSkipped: (levelIndex: number) => void;
  markTutorialSeen: (key: string) => void;
  /** Wipes all generated levels, boards, and completion/skip/tutorial state -- for the Settings > Game Progress reset. */
  resetAllProgress: () => void;
}

const KingsProgressContext = createContext<KingsProgressContextValue | null>(null);

export function KingsProgressProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PersistedShape>(defaultState);
  const [ready, setReady] = useState(false);
  const loadedOnce = useRef(false);
  // Mirrors `state` but updated synchronously (ahead of React's re-render),
  // so back-to-back calls in the same tick -- e.g. generating the current
  // level, then immediately prefetching the next one -- both see fresh data
  // instead of racing against a stale closure over `state`.
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

  const levelFor = useCallback((levelIndex: number): KingsLevel | undefined => state.generatedLevels[levelIndex], [state]);

  const ensureLevel = useCallback((levelIndex: number): void => {
    const current = stateRef.current;
    if (current.generatedLevels[levelIndex]) return;

    const level = createLevelForIndexRobust(levelIndex, current.skillRating, current.recentFingerprints);
    const fingerprint = fingerprintRegions(level.regions);
    const next: PersistedShape = {
      ...current,
      generatedLevels: { ...current.generatedLevels, [levelIndex]: level },
      boardsByLevel: { ...current.boardsByLevel, [levelIndex]: makeEmptyBoard(level.n) },
      recentFingerprints: [...current.recentFingerprints, fingerprint].slice(-MAX_RECENT_FINGERPRINTS),
    };
    stateRef.current = next;
    setState(next);
  }, []);

  // Always keep one level ready ahead of the player rather than only
  // generating on demand: as soon as the app has loaded progress, make sure
  // the very first level exists. GameScreen extends this same idea by
  // prefetching the *next* level the moment the current one is opened, so
  // the whole play session (not just the win/confetti moment) is the
  // background-generation window -- important for n=8-9 boards, which can
  // occasionally take several seconds to find.
  useEffect(() => {
    if (ready) ensureLevel(0);
  }, [ready, ensureLevel]);

  const cycleCell = useCallback((levelIndex: number, r: number, c: number) => {
    const current = stateRef.current;
    const board = current.boardsByLevel[levelIndex];
    if (!board) return;
    const nextBoard = board.map((row) => row.slice());
    nextBoard[r][c] = cycleCellState(board[r][c]);
    const next: PersistedShape = { ...current, boardsByLevel: { ...current.boardsByLevel, [levelIndex]: nextBoard } };
    stateRef.current = next;
    setState(next);
  }, []);

  /** Reveals one correct king as a locked hint cell. Returns false if the level has no hint left to give. */
  const giveHint = useCallback((levelIndex: number): boolean => {
    const current = stateRef.current;
    const level = current.generatedLevels[levelIndex];
    const board = current.boardsByLevel[levelIndex];
    if (!level || !board) return false;
    const nextBoard = applyHint(level, board);
    if (!nextBoard) return false;

    const next: PersistedShape = {
      ...current,
      boardsByLevel: { ...current.boardsByLevel, [levelIndex]: nextBoard },
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
      boardsByLevel: { ...current.boardsByLevel, [levelIndex]: makeEmptyBoard(level.n) },
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

  const value = useMemo<KingsProgressContextValue>(
    () => ({
      ready,
      levelFor,
      ensureLevel,
      boardsByLevel: state.boardsByLevel,
      levelsCompleted: new Set(state.levelsCompleted),
      levelsSkipped: new Set(state.levelsSkipped),
      tutorialsSeen: new Set(state.tutorialsSeen),
      skillRating: state.skillRating,
      cycleCell,
      giveHint,
      resetLevel,
      markLevelComplete,
      markLevelSkipped,
      markTutorialSeen,
      resetAllProgress,
    }),
    [ready, state, levelFor, ensureLevel, cycleCell, giveHint, resetLevel, markLevelComplete, markLevelSkipped, markTutorialSeen, resetAllProgress]
  );

  return React.createElement(KingsProgressContext.Provider, { value }, children);
}

export function useKingsProgress(): KingsProgressContextValue {
  const ctx = useContext(KingsProgressContext);
  if (!ctx) throw new Error('useKingsProgress must be used within a KingsProgressProvider');
  return ctx;
}
