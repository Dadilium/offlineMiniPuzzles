import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { composeProviders, dailyFromRobust, toDailyStoreConfig } from '../../../daily/dailyStore';
import { createProgressStore, type DifficultyControls, type ProgressStore, type ProgressStoreConfig } from '../../../state/createProgressStore';
import { buildOwnerGrid, freeArrowIds, launchOutcome, MAX_LIVES, sanitizeRemoved } from '../engine';
import { createLevelForIndexRobustAsync, fingerprintArrows, INITIAL_SKILL_RATING, nextSkillRating, type SkillRating } from '../generation';
import type { ArrowsLevel, ArrowsPlayerState, LaunchOutcome } from '../types';

// v2: boards are now 100% full and arrow ids are in removal order -- any v1
// boards (with holes) from pre-release testing get a clean slate.
const STORAGE_KEY = '@signal-arcade/arrows/progress/v2';

interface ArrowsCustom {
  /** Every level a player has reached is generated once and kept forever --
   * replaying an old level must show the same board even after the skill
   * rating has moved on. */
  boardByLevel: Record<number, ArrowsPlayerState>;
  /** Hearts lost on a level across every run, including runs that ran out
   * and were retried -- feeds the skill reducer on completion. */
  livesLostByLevel: Record<number, number>;
}

const freshBoard = (): ArrowsPlayerState => ({ removed: [], livesLeft: MAX_LIVES });

function isValidLevel(level: unknown): level is ArrowsLevel {
  const l = level as ArrowsLevel | null;
  return (
    !!l &&
    typeof l.rows === 'number' &&
    typeof l.cols === 'number' &&
    typeof l.tier === 'string' &&
    Array.isArray(l.arrows) &&
    l.arrows.every((arrow, i) => arrow?.id === i && Array.isArray(arrow.path) && arrow.path.length >= 2)
  );
}

function sanitizeBoard(level: ArrowsLevel, raw: unknown): ArrowsPlayerState {
  const parsed = (raw ?? {}) as Partial<ArrowsPlayerState>;
  const livesLeft = typeof parsed.livesLeft === 'number' ? Math.max(0, Math.min(MAX_LIVES, Math.round(parsed.livesLeft))) : MAX_LIVES;
  return { removed: sanitizeRemoved(level, parsed.removed), livesLeft };
}

function withBoard(custom: ArrowsCustom, levelIndex: number, board: ArrowsPlayerState): ArrowsCustom {
  return { ...custom, boardByLevel: { ...custom.boardByLevel, [levelIndex]: board } };
}

const config: ProgressStoreConfig<ArrowsLevel, ArrowsCustom> = {
  storageKey: STORAGE_KEY,
  initialSkillRating: INITIAL_SKILL_RATING,
  nextSkillRating: (prev, input) => nextSkillRating(prev as SkillRating, input as { hintsUsed: number; skipped: boolean; livesLost?: number }),
  extraSkillInputs: (levelIndex, state, phase) => ({ livesLost: phase === 'complete' ? (state.custom.livesLostByLevel[levelIndex] ?? 0) : 0 }),
  isValidLevel,
  // Async: big boards take a while, and the next level is built in the
  // background mid-level -- see generateArrowsLevelAsync.
  generate: (levelIndex, skillRating, recentFingerprints) => createLevelForIndexRobustAsync(levelIndex, skillRating as SkillRating, recentFingerprints),
  fingerprint: fingerprintArrows,
  defaultCustom: () => ({ boardByLevel: {}, livesLostByLevel: {} }),
  sanitizeCustom: (raw, generatedLevels) => {
    const parsed = (raw ?? {}) as Partial<ArrowsCustom>;
    const rawBoards = (parsed.boardByLevel ?? {}) as Record<string, unknown>;
    const rawLivesLost = (parsed.livesLostByLevel ?? {}) as Record<string, unknown>;
    const boardByLevel: Record<number, ArrowsPlayerState> = {};
    const livesLostByLevel: Record<number, number> = {};
    for (const [key, level] of Object.entries(generatedLevels)) {
      const idx = Number(key);
      boardByLevel[idx] = sanitizeBoard(level, rawBoards[key]);
      const lost = rawLivesLost[key];
      livesLostByLevel[idx] = typeof lost === 'number' && lost >= 0 ? lost : 0;
    }
    return { boardByLevel, livesLostByLevel };
  },
  onLevelGenerated: (custom, _level, levelIndex) => ({
    boardByLevel: { ...custom.boardByLevel, [levelIndex]: freshBoard() },
    livesLostByLevel: { ...custom.livesLostByLevel, [levelIndex]: 0 },
  }),
  resetLevelCustom: (custom, _level, levelIndex) => ({
    boardByLevel: { ...custom.boardByLevel, [levelIndex]: freshBoard() },
    livesLostByLevel: { ...custom.livesLostByLevel, [levelIndex]: 0 },
  }),
};

const store = createProgressStore(config);
// Daily Puzzle boards: same shape and board logic, keyed by day number.
const dailyStore = createProgressStore(
  toDailyStoreConfig(
    config,
    'arrows',
    dailyFromRobust((idx, rating, recent) => createLevelForIndexRobustAsync(idx, rating as SkillRating, recent))
  )
);

interface ArrowsProgressContextValue {
  ready: boolean;
  /** Pure lookup -- undefined until `ensureLevel` has generated this index. */
  levelFor: (levelIndex: number) => ArrowsLevel | undefined;
  /** Generates (and persists) a level for this index if missing. May update
   * provider state, so call it from an effect or event handler -- never from
   * a render body. A no-op once the level exists, so safe to prefetch. */
  ensureLevel: (levelIndex: number) => void;
  boardByLevel: Record<number, ArrowsPlayerState>;
  levelsCompleted: Set<number>;
  levelsSkipped: Set<number>;
  tutorialsSeen: Set<string>;
  /** Resolves a tap against the freshest state (not a render-time snapshot,
   * so two rapid taps in one frame both see each other) and commits the
   * removal on an exit. A bump changes nothing here -- the heart is only
   * taken at the moment of impact, via `registerBump`. Null when the arrow
   * is already gone or the player is out of hearts. */
  launchArrow: (levelIndex: number, arrowId: number) => LaunchOutcome | null;
  /** Takes one heart. Returns the hearts left. */
  registerBump: (levelIndex: number) => number;
  /** Fresh board + full hearts after running out -- keeps the hearts lost so
   * far (skill input) and hints used, unlike a full `resetLevel`. */
  retryLevel: (levelIndex: number) => void;
  /** Arrows a hint may launch right now (any free arrow is always safe). */
  hintCandidates: (levelIndex: number) => number[];
  /** Launches `arrowId` as a hint, counting it against the level. */
  giveHint: (levelIndex: number, arrowId: number) => LaunchOutcome | null;
  resetLevel: (levelIndex: number) => void;
  markLevelComplete: (levelIndex: number) => void;
  markLevelSkipped: (levelIndex: number) => void;
  markTutorialSeen: (key: string) => void;
  /** Wipes everything -- for the Settings > Game Progress reset. */
  resetAllProgress: () => void;
  /** Hub difficulty selector state + actions, straight from the shared store. */
  difficulty: DifficultyControls;
}

export const ArrowsProgressProvider = composeProviders(store.Provider, dailyStore.Provider);

export function useArrowsProgress(): ArrowsProgressContextValue {
  return useBoundProgress(store.useProgress());
}

/** Same API, backed by the Daily Puzzle store -- `levelIndex` is the day number. */
export function useArrowsDailyProgress(): ArrowsProgressContextValue {
  return useBoundProgress(dailyStore.useProgress());
}

function useBoundProgress(s: ProgressStore<ArrowsLevel, ArrowsCustom>): ArrowsProgressContextValue {
  const { getCurrent, commit } = s;

  /** Shared by tap and hint: validate against fresh state, commit an exit. */
  const resolveLaunch = useCallback(
    (levelIndex: number, arrowId: number, asHint: boolean): LaunchOutcome | null => {
      const current = getCurrent();
      const level = current.generatedLevels[levelIndex];
      const board = current.custom.boardByLevel[levelIndex];
      if (!level || !board || board.livesLeft <= 0) return null;
      const removed = new Set(board.removed);
      if (removed.has(arrowId) || !level.arrows[arrowId]) return null;

      const outcome = launchOutcome(level, buildOwnerGrid(level, removed), arrowId);
      if (outcome.kind === 'blocked') return asHint ? null : outcome;

      commit({
        ...current,
        custom: withBoard(current.custom, levelIndex, { ...board, removed: board.removed.concat(arrowId) }),
        hintsUsedByLevel: asHint ? { ...current.hintsUsedByLevel, [levelIndex]: (current.hintsUsedByLevel[levelIndex] ?? 0) + 1 } : current.hintsUsedByLevel,
      });
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return outcome;
    },
    [getCurrent, commit]
  );

  const launchArrow = useCallback((levelIndex: number, arrowId: number) => resolveLaunch(levelIndex, arrowId, false), [resolveLaunch]);
  const giveHint = useCallback((levelIndex: number, arrowId: number) => resolveLaunch(levelIndex, arrowId, true), [resolveLaunch]);

  const registerBump = useCallback(
    (levelIndex: number): number => {
      const current = getCurrent();
      const board = current.custom.boardByLevel[levelIndex];
      if (!board || board.livesLeft <= 0) return 0;
      const livesLeft = board.livesLeft - 1;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      commit({
        ...current,
        custom: {
          boardByLevel: { ...current.custom.boardByLevel, [levelIndex]: { ...board, livesLeft } },
          livesLostByLevel: { ...current.custom.livesLostByLevel, [levelIndex]: (current.custom.livesLostByLevel[levelIndex] ?? 0) + 1 },
        },
      });
      return livesLeft;
    },
    [getCurrent, commit]
  );

  const retryLevel = useCallback(
    (levelIndex: number) => {
      const current = getCurrent();
      if (!current.custom.boardByLevel[levelIndex]) return;
      commit({ ...current, custom: withBoard(current.custom, levelIndex, freshBoard()) });
    },
    [getCurrent, commit]
  );

  const hintCandidates = useCallback(
    (levelIndex: number): number[] => {
      const current = getCurrent();
      const level = current.generatedLevels[levelIndex];
      const board = current.custom.boardByLevel[levelIndex];
      if (!level || !board || board.livesLeft <= 0) return [];
      return freeArrowIds(level, new Set(board.removed));
    },
    [getCurrent]
  );

  return {
    ready: s.ready,
    levelFor: s.levelFor,
    ensureLevel: s.ensureLevel,
    boardByLevel: s.custom.boardByLevel,
    levelsCompleted: s.levelsCompleted,
    levelsSkipped: s.levelsSkipped,
    tutorialsSeen: s.tutorialsSeen,
    launchArrow,
    registerBump,
    retryLevel,
    hintCandidates,
    giveHint,
    resetLevel: s.resetLevel,
    markLevelComplete: s.markLevelComplete,
    markLevelSkipped: s.markLevelSkipped,
    markTutorialSeen: s.markTutorialSeen,
    resetAllProgress: s.resetAllProgress,
    difficulty: s.difficulty,
  };
}
