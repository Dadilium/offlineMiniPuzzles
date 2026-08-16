import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { createProgressStore } from '../../../state/createProgressStore';
import i18n from '../../../i18n';
import { matchPlacement, pickHintPlacement } from '../engine';
import {
  createLevelForIndexRobust,
  fingerprintFindWords,
  INITIAL_SKILL_RATING,
  nextSkillRating,
  type SkillRating,
  type WordBankLanguage,
} from '../generation';
import type { Cell, FindWordsLevel } from '../types';

// v2: internal shape changed when progress moved onto the shared
// createProgressStore -- old entries just get a clean slate (see that
// file's storageKey doc).
const STORAGE_KEY = '@signal-arcade/find-words/progress/v2';
/** Bounds the word-repeat-avoidance history -- large enough to cover several
 * levels' worth of words, small enough to stay well under even the smallest
 * word bank tier so generation never runs short of fresh words to pick from. */
const MAX_RECENT_WORDS = 40;

/** App language and the word bank language are the same 'en'/'fr' set, so no mapping is needed -- just a defensive default for any value outside that set. */
function currentLanguage(): WordBankLanguage {
  return i18n.language === 'fr' ? 'fr' : 'en';
}

interface FindWordsCustom {
  foundIndicesByLevel: Record<number, number[]>;
  recentWords: string[];
}

function isValidLevel(level: unknown): level is FindWordsLevel {
  const l = level as FindWordsLevel | null;
  return !!l && typeof l.rows === 'number' && typeof l.cols === 'number' && Array.isArray(l.grid) && Array.isArray(l.placements);
}

function sanitizeFoundIndices(found: unknown): number[] {
  if (!Array.isArray(found)) return [];
  return found.filter((i): i is number => typeof i === 'number');
}

const store = createProgressStore<FindWordsLevel, FindWordsCustom>({
  storageKey: STORAGE_KEY,
  initialSkillRating: INITIAL_SKILL_RATING,
  nextSkillRating: (prev, input) => nextSkillRating(prev as SkillRating, input as { hintsUsed: number; skipped: boolean }),
  isValidLevel,
  generate: (levelIndex, skillRating, recentFingerprints, custom) =>
    createLevelForIndexRobust(levelIndex, skillRating as SkillRating, currentLanguage(), recentFingerprints, custom.recentWords),
  fingerprint: (level) => fingerprintFindWords(level.rows, level.cols, level.placements),
  defaultCustom: () => ({ foundIndicesByLevel: {}, recentWords: [] }),
  sanitizeCustom: (raw, generatedLevels) => {
    const parsed = (raw ?? {}) as Partial<FindWordsCustom>;
    const rawFound = (parsed.foundIndicesByLevel ?? {}) as Record<string, unknown>;
    const foundIndicesByLevel: Record<number, number[]> = {};
    for (const key of Object.keys(generatedLevels)) {
      foundIndicesByLevel[Number(key)] = sanitizeFoundIndices(rawFound[key]);
    }
    return {
      foundIndicesByLevel,
      recentWords: Array.isArray(parsed.recentWords) ? parsed.recentWords.slice(-MAX_RECENT_WORDS) : [],
    };
  },
  // Also updates the global recentWords list -- only on real generation, not
  // on `resetLevel` (see resetLevelCustom), or replaying an already-cached
  // level would keep re-pushing the same words into the dedup history.
  onLevelGenerated: (custom, level, levelIndex) => ({
    foundIndicesByLevel: { ...custom.foundIndicesByLevel, [levelIndex]: [] },
    recentWords: [...custom.recentWords, ...level.placements.map((p) => p.word)].slice(-MAX_RECENT_WORDS),
  }),
  resetLevelCustom: (custom, _level, levelIndex) => ({
    ...custom,
    foundIndicesByLevel: { ...custom.foundIndicesByLevel, [levelIndex]: [] },
  }),
});

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
  /** Reveals one not-yet-found word in full. Returns false if every word is already found. */
  giveHint: (levelIndex: number) => boolean;
  resetLevel: (levelIndex: number) => void;
  markLevelComplete: (levelIndex: number) => void;
  markLevelSkipped: (levelIndex: number) => void;
  markTutorialSeen: (key: string) => void;
  /** Wipes all generated levels, found words, and completion/skip/tutorial state -- for the Settings > Game Progress reset. */
  resetAllProgress: () => void;
}

export const FindWordsProgressProvider = store.Provider;

export function useFindWordsProgress(): FindWordsProgressContextValue {
  const s = store.useProgress();
  const { getCurrent, commit } = s;

  const attemptWord = useCallback(
    (levelIndex: number, cells: Cell[]): number | null => {
      const current = getCurrent();
      const level = current.generatedLevels[levelIndex];
      if (!level) return null;
      const found = current.custom.foundIndicesByLevel[levelIndex] ?? [];

      const matched = matchPlacement(level, cells, found);
      if (matched === null) return null;

      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      commit({
        ...current,
        custom: { ...current.custom, foundIndicesByLevel: { ...current.custom.foundIndicesByLevel, [levelIndex]: [...found, matched] } },
      });
      return matched;
    },
    [getCurrent, commit]
  );

  /** Reveals one not-yet-found word in full, same as any other game's "finish one unit of progress" hint. Returns false if every word is already found. */
  const giveHint = useCallback(
    (levelIndex: number): boolean => {
      const current = getCurrent();
      const level = current.generatedLevels[levelIndex];
      if (!level) return false;
      const found = current.custom.foundIndicesByLevel[levelIndex] ?? [];
      const hintIndex = pickHintPlacement(level, found);
      if (hintIndex === null) return false;

      commit({
        ...current,
        custom: { ...current.custom, foundIndicesByLevel: { ...current.custom.foundIndicesByLevel, [levelIndex]: [...found, hintIndex] } },
        hintsUsedByLevel: { ...current.hintsUsedByLevel, [levelIndex]: (current.hintsUsedByLevel[levelIndex] ?? 0) + 1 },
      });
      return true;
    },
    [getCurrent, commit]
  );

  return {
    ready: s.ready,
    levelFor: s.levelFor,
    ensureLevel: s.ensureLevel,
    foundIndicesByLevel: s.custom.foundIndicesByLevel,
    levelsCompleted: s.levelsCompleted,
    levelsSkipped: s.levelsSkipped,
    tutorialsSeen: s.tutorialsSeen,
    skillRating: s.skillRating as SkillRating,
    attemptWord,
    giveHint,
    resetLevel: s.resetLevel,
    markLevelComplete: s.markLevelComplete,
    markLevelSkipped: s.markLevelSkipped,
    markTutorialSeen: s.markTutorialSeen,
    resetAllProgress: s.resetAllProgress,
  };
}
