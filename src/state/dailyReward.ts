// Pure daily-gift rules for the shared hint wallet -- no React/storage
// imports, so they can be checked in isolation
// (src/state/__scripts__/dailyReward.check.ts).

/**
 * Reward for each day of an unbroken daily-claim streak, 1-indexed and
 * cycling once it runs out (day 8 = day 1's reward again). Escalates gently
 * day-to-day with a day-7 milestone spike, rather than the old flat +2 --
 * gives the daily claim actual day-over-day momentum. Kept modest (average
 * ~2.4/day across a full cycle, vs the old flat 2) since hints are also the
 * rewarded-ad monetization lever -- too generous here would just mean fewer
 * ad views, not more retention.
 */
export const DAILY_REWARD_BY_STREAK_DAY = [1, 1, 2, 2, 3, 3, 5];

export function rewardForStreakDay(streakDay: number): number {
  return DAILY_REWARD_BY_STREAK_DAY[(streakDay - 1) % DAILY_REWARD_BY_STREAK_DAY.length];
}

export interface PersistedShape {
  balance: number;
  /** Local YYYY-MM-DD of the last successful daily claim, or null before the first one. */
  lastClaimDate: string | null;
  /** Length of the current unbroken daily-claim streak (>=1 once any claim has happened). */
  streakDays: number;
}

/** New installs start with exactly 2 hints -- the first launch is not a daily
 * claim (see `resolveLaunchClaim`), so the first gift arrives on day 2. */
export const STARTING_BALANCE = 2;

export function defaultState(): PersistedShape {
  return { balance: STARTING_BALANCE, lastClaimDate: null, streakDays: 0 };
}

export function sanitizePersisted(parsed: Partial<PersistedShape> | null): PersistedShape {
  if (!parsed) return defaultState();
  return {
    balance: typeof parsed.balance === 'number' && Number.isFinite(parsed.balance) ? parsed.balance : 0,
    lastClaimDate: typeof parsed.lastClaimDate === 'string' ? parsed.lastClaimDate : null,
    streakDays: typeof parsed.streakDays === 'number' && Number.isFinite(parsed.streakDays) ? parsed.streakDays : 0,
  };
}

/** Local calendar date, not UTC -- claiming resets at the player's own midnight. */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Whole-calendar-day gap between two YYYY-MM-DD keys -- via `Date` diff rather
 * than string comparison so month/year boundaries (and DST) aren't a special case. */
export function daysBetween(fromKey: string, toKey: string): number {
  const from = new Date(`${fromKey}T00:00:00`);
  const to = new Date(`${toKey}T00:00:00`);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

export interface LaunchResolution {
  state: PersistedShape;
  /** The claim granted on this launch, or null when nothing was granted. */
  claim: { reward: number; streakDays: number } | null;
}

/**
 * Pure: decides what a launch on `today` does to the persisted wallet.
 * - First-ever launch (no `lastClaimDate`): no gift, just stamps today so the
 *   next calendar day becomes streak day 1 -- the player keeps the starting
 *   balance and the gift alert first shows on day 2.
 * - Already claimed today, or the clock reads earlier than the last claim: no-op.
 * - Otherwise: a claim yesterday extends the streak, a gap restarts it at 1.
 * `force` (testing only) claims every launch and always counts as consecutive,
 * so relaunching cycles through the whole reward table.
 */
export function resolveLaunchClaim(current: PersistedShape, today: string, force: boolean): LaunchResolution {
  if (!force && current.lastClaimDate === null) {
    return { state: { ...current, lastClaimDate: today, streakDays: 0 }, claim: null };
  }
  const gap = current.lastClaimDate === null ? null : daysBetween(current.lastClaimDate, today);
  // Same day, or the device clock now reads earlier than the last claim --
  // granting on a backwards clock would let anyone farm hints by toggling
  // the date. Nothing is granted until the real calendar passes the last claim.
  if (!force && gap !== null && gap <= 0) {
    return { state: current, claim: null };
  }
  const consecutive = force || gap === 1;
  const streakDays = consecutive ? current.streakDays + 1 : 1;
  const reward = rewardForStreakDay(streakDays);
  return {
    state: { balance: current.balance + reward, lastClaimDate: today, streakDays },
    claim: { reward, streakDays },
  };
}
