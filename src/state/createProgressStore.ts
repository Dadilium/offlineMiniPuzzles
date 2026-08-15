import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_MAX_RECENT_FINGERPRINTS = 50;
/**
 * Sanity ceiling on how many per-level entries a real player could ever
 * legitimately reach -- generously above any realistic session, purely to
 * detect a corrupted/runaway-grown persisted blob (e.g. from a since-fixed
 * bug) rather than faithfully reloading and re-persisting it forever. A
 * `Record` with anywhere near this many keys is what trips Hermes's
 * "Property storage exceeds N properties" engine limit, which otherwise
 * throws synchronously and uncaught from the persistence effect below.
 */
const DEFAULT_MAX_GENERATED_LEVELS = 5000;

export interface ProgressState<TLevel, TCustom> {
  generatedLevels: Record<number, TLevel>;
  /** Every bit of per-game bespoke state (in-progress board/path/tubes, hinted-cell locks, whatever else that game needs) lives in here -- opaque to this file, owned entirely by each game's own config. */
  custom: TCustom;
  levelsCompleted: number[];
  levelsSkipped: number[];
  tutorialsSeen: string[];
  skillRating: number;
  recentFingerprints: string[];
  hintsUsedByLevel: Record<number, number>;
}

export interface ProgressStoreConfig<TLevel, TCustom> {
  /** Bump the version suffix (e.g. `/v1` -> `/v2`) whenever `custom`'s shape
   * changes, matching this codebase's existing convention (see Cross Sums /
   * Tents & Trees) -- old, now-unreadable entries just get a clean slate
   * rather than needing a migration. */
  storageKey: string;
  initialSkillRating: number;
  nextSkillRating: (prev: number, input: { hintsUsed: number; skipped: boolean; [extra: string]: unknown }) => number;
  /** Extra fields folded into the `nextSkillRating` input beyond the default
   * `{hintsUsed, skipped}` -- e.g. Matching Numbers' `addNumbersUsed`. Called
   * separately for the complete/skip paths since a skip may want to zero out
   * fields a real completion wouldn't (see Matching Numbers, which never
   * penalizes on-skip for Add Numbers actually used). */
  extraSkillInputs?: (levelIndex: number, state: ProgressState<TLevel, TCustom>, phase: 'complete' | 'skip') => Record<string, unknown>;
  isValidLevel: (level: unknown) => level is TLevel;
  /** Generates a level for this index. May return synchronously (every game
   * but Kings) or a Promise (Kings' background-search generation) -- both
   * are handled transparently by `ensureLevel`. `opts` is whatever
   * `ensureLevel`'s caller passed through (e.g. Kings' `{urgent}`). */
  generate: (levelIndex: number, skillRating: number, recentFingerprints: string[], custom: TCustom, opts?: Record<string, unknown>) => TLevel | Promise<TLevel>;
  fingerprint: (level: TLevel) => string;
  defaultCustom: () => TCustom;
  /** Validates/repairs a persisted `custom` blob on load -- given the
   * already-validated `generatedLevels`, since most games' per-level custom
   * state needs to cross-check against its level (board size, clue count,
   * etc). */
  sanitizeCustom: (raw: unknown, generatedLevels: Record<number, TLevel>) => TCustom;
  /** Called once right after a level is generated -- sets up this level's own
   * slot(s) in `custom` (e.g. an empty board) AND any global bookkeeping tied
   * to generation itself (e.g. Find Words' recently-used-words list). Not
   * reused for `resetLevel` (see `resetLevelCustom`) since global bookkeeping
   * like that must only ever run once per level, not every replay. */
  onLevelGenerated: (custom: TCustom, level: TLevel, levelIndex: number) => TCustom;
  /** Resets just this level's own slot(s) in `custom` back to a fresh start
   * -- no global bookkeeping (that's `onLevelGenerated`'s job, run once). */
  resetLevelCustom: (custom: TCustom, level: TLevel, levelIndex: number) => TCustom;
  /** Passed to the initial "always keep level 0 ready" bootstrap `ensureLevel`
   * call only -- e.g. Kings' `{urgent: true}`, since the player is actively
   * waiting on it. Omit for games with no such distinction. */
  initialEnsureOpts?: Record<string, unknown>;
  maxRecentFingerprints?: number;
  maxGeneratedLevels?: number;
  /** Debounces the persistence write by this many ms after the last state
   * change (Block Fill: state changes on every cell crossed mid-drag, so an
   * immediate write would stringify+persist the whole blob dozens of times a
   * second). Default: write immediately. */
  saveDebounceMs?: number;
}

export interface ProgressStore<TLevel, TCustom> {
  ready: boolean;
  levelFor: (levelIndex: number) => TLevel | undefined;
  ensureLevel: (levelIndex: number, opts?: Record<string, unknown>) => void;
  custom: TCustom;
  levelsCompleted: Set<number>;
  levelsSkipped: Set<number>;
  tutorialsSeen: Set<string>;
  skillRating: number;
  hintsUsedByLevel: Record<number, number>;
  markLevelComplete: (levelIndex: number) => void;
  markLevelSkipped: (levelIndex: number) => void;
  markTutorialSeen: (key: string) => void;
  resetLevel: (levelIndex: number) => void;
  resetAllProgress: () => void;
  /** Escape hatch for game-specific mutations (drag a rect, pour a tube,
   * scan for a legal move...) that need a fresh synchronous read-then-write,
   * exactly like every game's own `stateRef.current` pair used to. */
  getCurrent: () => ProgressState<TLevel, TCustom>;
  commit: (next: ProgressState<TLevel, TCustom>) => void;
}

/**
 * Factory for the AsyncStorage-backed provider+hook every game's progress
 * state uses. Owns the plumbing that was previously reimplemented near-
 * identically in each game's `useXProgress.ts` (~250 lines apiece): the
 * load/save effects (including the corruption ceiling and the
 * `JSON.stringify`-can-throw guard, previously present in only some games),
 * the synchronous `stateRef` mirror, and the common fields/actions
 * (`levelsCompleted`, `levelsSkipped`, `tutorialsSeen`, `skillRating`,
 * `recentFingerprints`, `hintsUsedByLevel`, `markLevelComplete`,
 * `markLevelSkipped`, `markTutorialSeen`, `resetAllProgress`). Each game's
 * own bespoke state (board, path, tubes, hinted-cell locks...) still lives
 * entirely in that game's `useXProgress.ts`, via the `custom` bucket and the
 * `getCurrent`/`commit` escape hatch -- this file has no idea what a rect or
 * a tube is.
 */
export function createProgressStore<TLevel, TCustom>(config: ProgressStoreConfig<TLevel, TCustom>) {
  const maxRecentFingerprints = config.maxRecentFingerprints ?? DEFAULT_MAX_RECENT_FINGERPRINTS;
  const maxGeneratedLevels = config.maxGeneratedLevels ?? DEFAULT_MAX_GENERATED_LEVELS;

  function defaultState(): ProgressState<TLevel, TCustom> {
    return {
      generatedLevels: {},
      custom: config.defaultCustom(),
      levelsCompleted: [],
      levelsSkipped: [],
      tutorialsSeen: [],
      skillRating: config.initialSkillRating,
      recentFingerprints: [],
      hintsUsedByLevel: {},
    };
  }

  function sanitizePersisted(parsed: Partial<ProgressState<TLevel, TCustom>> | null): ProgressState<TLevel, TCustom> {
    if (!parsed) return defaultState();

    // A legitimately-reached level count anywhere near this is not something
    // real play produces -- treat it as corrupted/runaway-grown data and
    // self-heal to a clean slate rather than faithfully reloading (and then
    // re-persisting) an oversized object on every launch.
    const rawGeneratedLevels = parsed.generatedLevels;
    if (rawGeneratedLevels && Object.keys(rawGeneratedLevels).length > maxGeneratedLevels) {
      return defaultState();
    }

    const generatedLevels: Record<number, TLevel> = {};
    for (const [key, level] of Object.entries(parsed.generatedLevels ?? {})) {
      if (!config.isValidLevel(level)) continue;
      generatedLevels[Number(key)] = level as TLevel;
    }

    const rawHints = parsed.hintsUsedByLevel;
    const hintsUsedByLevel: Record<number, number> = {};
    if (rawHints && typeof rawHints === 'object') {
      for (const [key, value] of Object.entries(rawHints)) {
        if (typeof value === 'number' && generatedLevels[Number(key)]) hintsUsedByLevel[Number(key)] = value;
      }
    }

    return {
      generatedLevels,
      custom: config.sanitizeCustom(parsed.custom, generatedLevels),
      levelsCompleted: Array.isArray(parsed.levelsCompleted) ? parsed.levelsCompleted : [],
      levelsSkipped: Array.isArray(parsed.levelsSkipped) ? parsed.levelsSkipped : [],
      tutorialsSeen: Array.isArray(parsed.tutorialsSeen) ? parsed.tutorialsSeen : [],
      skillRating: typeof parsed.skillRating === 'number' ? parsed.skillRating : config.initialSkillRating,
      recentFingerprints: Array.isArray(parsed.recentFingerprints) ? parsed.recentFingerprints.slice(-maxRecentFingerprints) : [],
      hintsUsedByLevel,
    };
  }

  const ProgressContext = createContext<ProgressStore<TLevel, TCustom> | null>(null);

  function Provider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<ProgressState<TLevel, TCustom>>(defaultState);
    const [ready, setReady] = useState(false);
    const loadedOnce = useRef(false);
    // Mirrors `state` but updated synchronously (ahead of React's
    // re-render), so back-to-back calls in the same tick both see fresh
    // data instead of racing against a stale closure over `state`.
    const stateRef = useRef(state);
    stateRef.current = state;
    // Tracks levels currently being generated (async games only) so a
    // second call for the same index doesn't kick off a duplicate search.
    const pendingGeneration = useRef<Set<number>>(new Set());

    const getCurrent = useCallback(() => stateRef.current, []);
    const commit = useCallback((next: ProgressState<TLevel, TCustom>) => {
      stateRef.current = next;
      setState(next);
    }, []);

    useEffect(() => {
      (async () => {
        try {
          const raw = await AsyncStorage.getItem(config.storageKey);
          const parsed = raw ? (JSON.parse(raw) as Partial<ProgressState<TLevel, TCustom>>) : null;
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
      if (!loadedOnce.current) return;
      const persist = () => {
        // `JSON.stringify` itself can throw synchronously (e.g. if `state`
        // ever ballooned past an engine's property-storage limit) -- a
        // `.catch` only guards the async `AsyncStorage.setItem` promise, so
        // a stringify failure needs its own guard or it escapes uncaught.
        let serialized: string;
        try {
          serialized = JSON.stringify(stateRef.current);
        } catch {
          return;
        }
        AsyncStorage.setItem(config.storageKey, serialized).catch(() => {});
      };
      if (!config.saveDebounceMs) {
        persist();
        return undefined;
      }
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(persist, config.saveDebounceMs);
      return () => {
        if (saveTimer.current) clearTimeout(saveTimer.current);
      };
    }, [state]);

    const levelFor = useCallback((levelIndex: number): TLevel | undefined => state.generatedLevels[levelIndex], [state]);

    const applyGenerated = useCallback((base: ProgressState<TLevel, TCustom>, levelIndex: number, level: TLevel): ProgressState<TLevel, TCustom> => {
      const fingerprint = config.fingerprint(level);
      return {
        ...base,
        generatedLevels: { ...base.generatedLevels, [levelIndex]: level },
        custom: config.onLevelGenerated(base.custom, level, levelIndex),
        recentFingerprints: [...base.recentFingerprints, fingerprint].slice(-maxRecentFingerprints),
      };
    }, []);

    const ensureLevel = useCallback(
      (levelIndex: number, opts?: Record<string, unknown>): void => {
        const current = stateRef.current;
        if (current.generatedLevels[levelIndex]) return;
        if (pendingGeneration.current.has(levelIndex)) return;

        const result = config.generate(levelIndex, current.skillRating, current.recentFingerprints, current.custom, opts);
        if (result instanceof Promise) {
          pendingGeneration.current.add(levelIndex);
          result
            .then((level) => {
              pendingGeneration.current.delete(levelIndex);
              const latest = stateRef.current;
              if (latest.generatedLevels[levelIndex]) return; // generated via another path while this was in flight
              commit(applyGenerated(latest, levelIndex, level));
            })
            .catch(() => {
              pendingGeneration.current.delete(levelIndex);
            });
          return;
        }
        commit(applyGenerated(current, levelIndex, result));
      },
      [applyGenerated, commit]
    );

    // Always keep one level ready ahead of the player rather than only
    // generating on demand: as soon as the app has loaded progress, make
    // sure the very first level exists.
    useEffect(() => {
      if (ready) ensureLevel(0, config.initialEnsureOpts);
    }, [ready, ensureLevel]);

    const markLevelComplete = useCallback(
      (levelIndex: number) => {
        const current = stateRef.current;
        if (current.levelsCompleted.includes(levelIndex)) return;
        const hintsUsed = current.hintsUsedByLevel[levelIndex] ?? 0;
        const extra = config.extraSkillInputs?.(levelIndex, current, 'complete') ?? {};
        const next: ProgressState<TLevel, TCustom> = {
          ...current,
          levelsCompleted: current.levelsCompleted.concat(levelIndex),
          skillRating: config.nextSkillRating(current.skillRating, { hintsUsed, skipped: false, ...extra }),
        };
        commit(next);
      },
      [commit]
    );

    /** Marks a level skipped (via ad) so the next level unlocks -- distinct from actually solving it. */
    const markLevelSkipped = useCallback(
      (levelIndex: number) => {
        const current = stateRef.current;
        if (current.levelsCompleted.includes(levelIndex) || current.levelsSkipped.includes(levelIndex)) return;
        const extra = config.extraSkillInputs?.(levelIndex, current, 'skip') ?? {};
        const next: ProgressState<TLevel, TCustom> = {
          ...current,
          levelsSkipped: current.levelsSkipped.concat(levelIndex),
          skillRating: config.nextSkillRating(current.skillRating, { hintsUsed: 0, skipped: true, ...extra }),
        };
        commit(next);
      },
      [commit]
    );

    const markTutorialSeen = useCallback(
      (key: string) => {
        const current = stateRef.current;
        if (current.tutorialsSeen.includes(key)) return;
        commit({ ...current, tutorialsSeen: current.tutorialsSeen.concat(key) });
      },
      [commit]
    );

    const resetLevel = useCallback(
      (levelIndex: number) => {
        const current = stateRef.current;
        const level = current.generatedLevels[levelIndex];
        if (!level) return;
        commit({
          ...current,
          custom: config.resetLevelCustom(current.custom, level, levelIndex),
          hintsUsedByLevel: { ...current.hintsUsedByLevel, [levelIndex]: 0 },
        });
      },
      [commit]
    );

    const resetAllProgress = useCallback(() => {
      const next = defaultState();
      commit(next);
      AsyncStorage.removeItem(config.storageKey).catch(() => {});
    }, [commit]);

    const value = useMemo<ProgressStore<TLevel, TCustom>>(
      () => ({
        ready,
        levelFor,
        ensureLevel,
        custom: state.custom,
        levelsCompleted: new Set(state.levelsCompleted),
        levelsSkipped: new Set(state.levelsSkipped),
        tutorialsSeen: new Set(state.tutorialsSeen),
        skillRating: state.skillRating,
        hintsUsedByLevel: state.hintsUsedByLevel,
        markLevelComplete,
        markLevelSkipped,
        markTutorialSeen,
        resetLevel,
        resetAllProgress,
        getCurrent,
        commit,
      }),
      [ready, state, levelFor, ensureLevel, markLevelComplete, markLevelSkipped, markTutorialSeen, resetLevel, resetAllProgress, getCurrent, commit]
    );

    return React.createElement(ProgressContext.Provider, { value }, children);
  }

  function useProgress(): ProgressStore<TLevel, TCustom> {
    const ctx = useContext(ProgressContext);
    if (!ctx) throw new Error('useProgress must be used within its matching Provider');
    return ctx;
  }

  return { Provider, useProgress };
}
