// Pure rules for when to ask for a store rating -- no React/native imports,
// so they can be checked in isolation (src/review/__scripts__/reviewRules.check.ts).
//
// Only ever after a clearly positive moment, and only through the OS's own
// review sheet (which itself caps how often it really appears):
//  - a clean win (no hints) at Hard or Expert, at the 3rd / 15th / 40th one;
//  - an overall daily streak reaching 7 / 30 / 100 days.
// A milestone makes the ask "owed"; it's presented on the next win screen.
// Never after a failure, a skip or an ad -- those never produce an event.
import type { DifficultyTier } from '../state/difficultyTiers';

export const CLEAN_HARD_WIN_MILESTONES: readonly number[] = [3, 15, 40];
export const DAILY_STREAK_MILESTONES: readonly number[] = [7, 30, 100];
/** No ask in the player's first days -- they haven't formed an opinion yet. */
export const MIN_INSTALL_AGE_MS = 2 * 86_400_000;
/** Spacing between asks, on top of whatever the OS enforces. */
export const COOLDOWN_MS = 120 * 86_400_000;
/** Lifetime cap -- after this the Settings row is the only way to rate. */
export const MAX_PROMPTS = 3;

export interface ReviewState {
  /** First launch with this feature -- the install-age gate counts from here. */
  firstSeenAt: number | null;
  cleanHardWins: number;
  /** Highest daily-streak milestone already counted, so a streak only triggers each milestone once. */
  bestStreakMilestone: number;
  owed: boolean;
  lastPromptAt: number | null;
  promptCount: number;
}

export type ReviewEvent =
  | { type: 'levelWin'; tier: DifficultyTier; hintsUsed: number }
  | { type: 'dailyStreak'; streak: number };

export function defaultReviewState(): ReviewState {
  return { firstSeenAt: null, cleanHardWins: 0, bestStreakMilestone: 0, owed: false, lastPromptAt: null, promptCount: 0 };
}

export function sanitizeReviewState(raw: unknown): ReviewState {
  const r = raw as Partial<ReviewState> | null;
  const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
  const numOrNull = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  return {
    firstSeenAt: numOrNull(r?.firstSeenAt),
    cleanHardWins: num(r?.cleanHardWins, 0),
    bestStreakMilestone: num(r?.bestStreakMilestone, 0),
    owed: typeof r?.owed === 'boolean' ? r.owed : false,
    lastPromptAt: numOrNull(r?.lastPromptAt),
    promptCount: num(r?.promptCount, 0),
  };
}

/** Stamps the install-age clock on first sight; no-op afterwards. */
export function withFirstSeen(state: ReviewState, now: number): ReviewState {
  return state.firstSeenAt === null ? { ...state, firstSeenAt: now } : state;
}

function exhaustedOrCoolingDown(state: ReviewState, now: number): boolean {
  if (state.promptCount >= MAX_PROMPTS) return true;
  return state.lastPromptAt !== null && now - state.lastPromptAt < COOLDOWN_MS;
}

/**
 * Folds one positive event in. A milestone only becomes owed when an ask
 * would actually be allowed later (not exhausted or mid-cooldown), so a
 * milestone hit during a cooldown is dropped rather than surfacing months
 * after the moment that earned it.
 */
export function applyReviewEvent(state: ReviewState, event: ReviewEvent, now: number): ReviewState {
  let milestone = false;
  let next = state;
  if (event.type === 'levelWin') {
    if ((event.tier !== 'hard' && event.tier !== 'expert') || event.hintsUsed > 0) return state;
    const cleanHardWins = state.cleanHardWins + 1;
    milestone = CLEAN_HARD_WIN_MILESTONES.includes(cleanHardWins);
    next = { ...state, cleanHardWins };
  } else {
    const reached = DAILY_STREAK_MILESTONES.filter((m) => event.streak >= m && m > state.bestStreakMilestone);
    if (reached.length === 0) return state;
    milestone = true;
    next = { ...state, bestStreakMilestone: Math.max(...reached) };
  }
  if (!milestone || exhaustedOrCoolingDown(next, now)) return next;
  return { ...next, owed: true };
}

/** Whether to show the OS review sheet now (on a win screen). */
export function shouldPresentReview(state: ReviewState, now: number): boolean {
  if (!state.owed || exhaustedOrCoolingDown(state, now)) return false;
  return state.firstSeenAt !== null && now - state.firstSeenAt >= MIN_INSTALL_AGE_MS;
}

export function withPromptShown(state: ReviewState, now: number): ReviewState {
  return { ...state, owed: false, lastPromptAt: now, promptCount: state.promptCount + 1 };
}
