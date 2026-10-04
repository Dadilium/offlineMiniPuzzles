// Pure interstitial cadence rules -- no React Native or storage imports, so
// they can be checked in isolation (src/ads/__scripts__/interstitialRules.check.ts).
// Persistence and the ad SDK live in InterstitialProvider.

type AnalyticsContext = Record<string, string>;

export interface InterstitialSchedule {
  first: number;
  interval: number;
}

export interface InterstitialState {
  /** Level completions since the last interstitial the player actually
   * watched through to close. */
  sinceLastAd: number;
  /** Whether any interstitial has ever been shown to completion -- before
   * the first one, `schedule.first` is the threshold; after, `interval` is. */
  everShownAd: boolean;
  /** True from the moment an ad comes due (and is owed) until it's watched
   * to close. Keeps this cadence due on further triggers while the owed ad
   * is still outstanding, instead of waiting for the schedule to come back
   * around. */
  pendingRetry: boolean;
}

export const DEFAULT_INTERSTITIAL_STATE: InterstitialState = {
  sinceLastAd: 0,
  everShownAd: false,
  pendingRetry: false,
};

/** Pure decision step for one trigger event (a level completion, or any
 * other cadence-tracked action): bumps the counter and says whether an
 * interstitial is due. `forceDue` short-circuits straight to due regardless
 * of the count-based threshold (e.g. Matching Numbers forces it when a level
 * took unusually long to solve) without disturbing the counter bookkeeping.
 * Persistence is the caller's job. */
export function nextInterstitialDecision(
  state: InterstitialState,
  schedule: InterstitialSchedule,
  forceDue: boolean = false
): { due: boolean; sinceLastAd: number } {
  const sinceLastAd = state.sinceLastAd + 1;
  const threshold = state.everShownAd ? schedule.interval : schedule.first;
  const due = state.pendingRetry || forceDue || sinceLastAd >= threshold;
  return { due, sinceLastAd };
}

/** Minimum gap between any two interstitials, app-wide -- across every game
 * and every trigger (level completions and in-level actions alike). The
 * per-game count schedule (`interstitialScheduleFor`) does the regular spacing; this is the safety
 * net for bursts it can't see: back-to-back short levels, Matching Numbers'
 * forced/assist ads stacking up, or hopping between games. */
export const INTERSTITIAL_COOLDOWN_MS = 90 * 1000;

/** Pure: whether an interstitial shown at `lastShownAt` (epoch ms, or null if
 * none ever) is still inside the app-wide cooldown at `now`. A `lastShownAt`
 * in the future (device clock moved back) is treated as expired rather than
 * blocking ads indefinitely. */
export function isInterstitialCoolingDown(lastShownAt: number | null, now: number, cooldownMs: number = INTERSTITIAL_COOLDOWN_MS): boolean {
  if (lastShownAt === null) return false;
  const elapsed = now - lastShownAt;
  return elapsed >= 0 && elapsed < cooldownMs;
}

/**
 * An interstitial that has been decided (a cadence came due) but not yet
 * watched through to close. Persisted, so killing the app between the win
 * and the next level -- or mid-ad -- only defers it to the next level start,
 * it never cancels it. Lists every cadence counter that came due while it
 * was outstanding, so one watched ad settles all of them at once.
 */
export interface OwedInterstitial {
  storageKeys: string[];
  /** Analytics context of the most recent trigger that made it due. */
  context: AnalyticsContext;
}

/** Pure: folds one more due trigger into the (possibly absent) owed ad. */
export function withOwedTrigger(owed: OwedInterstitial | null, storageKey: string, context: AnalyticsContext): OwedInterstitial {
  const storageKeys = owed?.storageKeys.includes(storageKey) ? owed.storageKeys : [...(owed?.storageKeys ?? []), storageKey];
  return { storageKeys, context };
}

/** Pure: what's still owed after `watched` was shown to close -- null when
 * nothing is. Keeps counters that came due while the ad was on screen. */
export function withoutWatched(owed: OwedInterstitial | null, watched: OwedInterstitial): OwedInterstitial | null {
  const storageKeys = owed?.storageKeys.filter((key) => !watched.storageKeys.includes(key)) ?? [];
  return owed && storageKeys.length > 0 ? { ...owed, storageKeys } : null;
}

/** Counter state for a cadence whose owed ad was just watched to close. */
export const SETTLED_INTERSTITIAL_STATE: InterstitialState = { sinceLastAd: 0, everShownAd: true, pendingRetry: false };
