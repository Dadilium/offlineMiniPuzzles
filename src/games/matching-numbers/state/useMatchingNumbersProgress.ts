import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { applyAddNumbers, applyMatch, attemptMatch, findLegalMove, MAX_ADD_NUMBERS, removeRow } from '../engine';
import { createLevelForIndexRobust, fingerprintGrid, INITIAL_SKILL_RATING, nextSkillRating, type SkillRating } from '../generation';
import type { Cell, GridValue, MatchingNumbersLevel } from '../types';

const STORAGE_KEY = '@signal-arcade/matching-numbers/progress/v1';
/** Bounds the shape-dedup history so it can't grow unbounded over 1000+ levels. */
const MAX_RECENT_FINGERPRINTS = 50;

interface PersistedShape {
  /** Every level a player has reached is generated once and kept forever --
   * replaying an old level must show the same puzzle even after skill rating
   * has moved on. Keyed by level index. */
  generatedLevels: Record<number, MatchingNumbersLevel>;
  /** The CURRENT live board (post-taps, post-Add-Numbers) -- separate from
   * generatedLevels[idx].grid (the pristine initial board) so progress can
   * resume mid-solve. Row count here can exceed the level's original `rows`
   * once Add Numbers has been used. */
  boardsByLevel: Record<number, GridValue[][]>;
  levelsCompleted: number[];
  levelsSkipped: number[];
  tutorialsSeen: string[];
  skillRating: SkillRating;
  recentFingerprints: string[];
  hintsUsedByLevel: Record<number, number>;
  addNumbersUsedByLevel: Record<number, number>;
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
    addNumbersUsedByLevel: {},
  };
}

function isValidLevel(level: unknown): level is MatchingNumbersLevel {
  const l = level as MatchingNumbersLevel | null;
  return !!l && typeof l.rows === 'number' && typeof l.cols === 'number' && Array.isArray(l.grid) && Array.isArray(l.solutionOrder);
}

function cloneGrid(grid: GridValue[][]): GridValue[][] {
  return grid.map((row) => row.slice());
}

/** Guards against a corrupt/stale board shape -- falls back to the level's own pristine grid. */
function sanitizeBoard(board: unknown, level: MatchingNumbersLevel): GridValue[][] {
  if (!Array.isArray(board) || board.length < level.rows) return cloneGrid(level.grid);
  for (const row of board) {
    if (!Array.isArray(row) || row.length !== level.cols) return cloneGrid(level.grid);
  }
  return board as GridValue[][];
}

function sanitizePersisted(parsed: Partial<PersistedShape> | null): PersistedShape {
  if (!parsed) return defaultState();

  const generatedLevels: Record<number, MatchingNumbersLevel> = {};
  const boardsByLevel: Record<number, GridValue[][]> = {};
  const rawBoards = (parsed.boardsByLevel ?? {}) as Record<string, unknown>;

  for (const [key, level] of Object.entries(parsed.generatedLevels ?? {})) {
    if (!isValidLevel(level)) continue;
    const idx = Number(key);
    generatedLevels[idx] = level;
    boardsByLevel[idx] = sanitizeBoard(rawBoards[key], level);
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
    addNumbersUsedByLevel:
      parsed.addNumbersUsedByLevel && typeof parsed.addNumbersUsedByLevel === 'object'
        ? (parsed.addNumbersUsedByLevel as Record<number, number>)
        : {},
  };
}

interface MatchingNumbersProgressContextValue {
  ready: boolean;
  /** Pure lookup -- undefined until `ensureLevel` has generated this index. */
  levelFor: (levelIndex: number) => MatchingNumbersLevel | undefined;
  /** Generates (and persists) a level for this index if missing. Safe to call
   * speculatively ahead of need (e.g. to prefetch the next level) since it's
   * a no-op once a level has already been generated for that index. */
  ensureLevel: (levelIndex: number) => void;
  boardsByLevel: Record<number, GridValue[][]>;
  levelsCompleted: Set<number>;
  levelsSkipped: Set<number>;
  tutorialsSeen: Set<string>;
  skillRating: SkillRating;
  addNumbersUsedByLevel: Record<number, number>;
  /** Assumes the caller already validated legality via engine.attemptMatch (e.g. to drive a success/fail animation) -- unconditionally clears both cells. */
  commitMatch: (levelIndex: number, a: Cell, b: Cell) => void;
  /** Removes a single row once its shift-up collapse animation has finished -- see engine.findFullyEmptyRow. */
  collapseRow: (levelIndex: number, rowIndex: number) => void;
  /** Spends an Add Numbers charge if any remain. Returns false (no-op) once MAX_ADD_NUMBERS has been used this level. */
  addNumbers: (levelIndex: number) => boolean;
  /** Live scan of the current board for any currently-legal pair -- never reads the level's solutionOrder certificate (see engine.ts). Returns null if the board is stuck. */
  giveHint: (levelIndex: number) => [Cell, Cell] | null;
  /** Restores the level's pristine board and resets its Add Numbers charges. */
  resetLevel: (levelIndex: number) => void;
  markLevelComplete: (levelIndex: number) => void;
  markLevelSkipped: (levelIndex: number) => void;
  markTutorialSeen: (key: string) => void;
  /** Wipes all generated levels, boards, and completion/skip/tutorial state -- for the Settings > Game Progress reset. */
  resetAllProgress: () => void;
}

const MatchingNumbersProgressContext = createContext<MatchingNumbersProgressContextValue | null>(null);

export function MatchingNumbersProgressProvider({ children }: { children: React.ReactNode }) {
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

  const levelFor = useCallback((levelIndex: number): MatchingNumbersLevel | undefined => state.generatedLevels[levelIndex], [state]);

  const ensureLevel = useCallback((levelIndex: number): void => {
    const current = stateRef.current;
    if (current.generatedLevels[levelIndex]) return;

    const level = createLevelForIndexRobust(levelIndex, current.skillRating, current.recentFingerprints);
    const fingerprint = fingerprintGrid(level.grid);
    const next: PersistedShape = {
      ...current,
      generatedLevels: { ...current.generatedLevels, [levelIndex]: level },
      boardsByLevel: { ...current.boardsByLevel, [levelIndex]: cloneGrid(level.grid) },
      recentFingerprints: [...current.recentFingerprints, fingerprint].slice(-MAX_RECENT_FINGERPRINTS),
    };
    stateRef.current = next;
    setState(next);
  }, []);

  // Always keep one level ready ahead of the player rather than only
  // generating on demand: as soon as the app has loaded progress, make sure
  // the very first level exists. GameScreen extends this same idea by
  // prefetching the *next* level the moment the current one is opened.
  useEffect(() => {
    if (ready) ensureLevel(0);
  }, [ready, ensureLevel]);

  const commitMatch = useCallback((levelIndex: number, a: Cell, b: Cell) => {
    const current = stateRef.current;
    const board = current.boardsByLevel[levelIndex];
    if (!board) return;
    const nextBoard = applyMatch(board, a, b);
    const next: PersistedShape = { ...current, boardsByLevel: { ...current.boardsByLevel, [levelIndex]: nextBoard } };
    stateRef.current = next;
    setState(next);
  }, []);

  /** Called once a fully-cleared row's shift-up animation has finished playing -- see engine.findFullyEmptyRow. */
  const collapseRow = useCallback((levelIndex: number, rowIndex: number) => {
    const current = stateRef.current;
    const board = current.boardsByLevel[levelIndex];
    if (!board) return;
    const nextBoard = removeRow(board, rowIndex);
    const next: PersistedShape = { ...current, boardsByLevel: { ...current.boardsByLevel, [levelIndex]: nextBoard } };
    stateRef.current = next;
    setState(next);
  }, []);

  const addNumbers = useCallback((levelIndex: number): boolean => {
    const current = stateRef.current;
    const board = current.boardsByLevel[levelIndex];
    if (!board) return false;
    const used = current.addNumbersUsedByLevel[levelIndex] ?? 0;
    if (used >= MAX_ADD_NUMBERS) return false;

    const nextBoard = applyAddNumbers(board);
    const next: PersistedShape = {
      ...current,
      boardsByLevel: { ...current.boardsByLevel, [levelIndex]: nextBoard },
      addNumbersUsedByLevel: { ...current.addNumbersUsedByLevel, [levelIndex]: used + 1 },
    };
    stateRef.current = next;
    setState(next);
    return true;
  }, []);

  /** Never reads a level's solutionOrder certificate -- always a live scan of the current board, so it stays correct no matter how far the player has diverged from the certificate's original order. */
  const giveHint = useCallback((levelIndex: number): [Cell, Cell] | null => {
    const current = stateRef.current;
    const board = current.boardsByLevel[levelIndex];
    if (!board) return null;
    const move = findLegalMove(board);
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
      boardsByLevel: { ...current.boardsByLevel, [levelIndex]: cloneGrid(level.grid) },
      hintsUsedByLevel: { ...current.hintsUsedByLevel, [levelIndex]: 0 },
      addNumbersUsedByLevel: { ...current.addNumbersUsedByLevel, [levelIndex]: 0 },
    };
    stateRef.current = next;
    setState(next);
  }, []);

  const markLevelComplete = useCallback((levelIndex: number) => {
    const current = stateRef.current;
    if (current.levelsCompleted.includes(levelIndex)) return;
    const hintsUsed = current.hintsUsedByLevel[levelIndex] ?? 0;
    const addNumbersUsed = current.addNumbersUsedByLevel[levelIndex] ?? 0;
    const next: PersistedShape = {
      ...current,
      levelsCompleted: current.levelsCompleted.concat(levelIndex),
      skillRating: nextSkillRating(current.skillRating, { hintsUsed, addNumbersUsed, skipped: false }),
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
      skillRating: nextSkillRating(current.skillRating, { hintsUsed: 0, addNumbersUsed: 0, skipped: true }),
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

  const value = useMemo<MatchingNumbersProgressContextValue>(
    () => ({
      ready,
      levelFor,
      ensureLevel,
      boardsByLevel: state.boardsByLevel,
      levelsCompleted: new Set(state.levelsCompleted),
      levelsSkipped: new Set(state.levelsSkipped),
      tutorialsSeen: new Set(state.tutorialsSeen),
      skillRating: state.skillRating,
      addNumbersUsedByLevel: state.addNumbersUsedByLevel,
      commitMatch,
      collapseRow,
      addNumbers,
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
      commitMatch,
      collapseRow,
      addNumbers,
      giveHint,
      resetLevel,
      markLevelComplete,
      markLevelSkipped,
      markTutorialSeen,
      resetAllProgress,
    ]
  );

  return React.createElement(MatchingNumbersProgressContext.Provider, { value }, children);
}

export function useMatchingNumbersProgress(): MatchingNumbersProgressContextValue {
  const ctx = useContext(MatchingNumbersProgressContext);
  if (!ctx) throw new Error('useMatchingNumbersProgress must be used within a MatchingNumbersProgressProvider');
  return ctx;
}
