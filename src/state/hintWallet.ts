import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = '@signal-arcade/hints/wallet/v1';

// TEMP(testing): forces the daily-gift claim on every launch, ignoring
// `lastClaimDate`, so the new DailyGiftModal can be eyeballed repeatedly.
// Flip back to false before shipping.
const FORCE_DAILY_CLAIM_FOR_TESTING = false;

/**
 * Reward for each day of an unbroken daily-claim streak, 1-indexed and
 * cycling once it runs out (day 8 = day 1's reward again). Escalates gently
 * day-to-day with a day-7 milestone spike, rather than the old flat +2 --
 * gives the daily claim actual day-over-day momentum. Kept modest (average
 * ~2.4/day across a full cycle, vs the old flat 2) since hints are also the
 * rewarded-ad monetization lever -- too generous here would just mean fewer
 * ad views, not more retention.
 */
const DAILY_REWARD_BY_STREAK_DAY = [1, 1, 2, 2, 3, 3, 5];

function rewardForStreakDay(streakDay: number): number {
  return DAILY_REWARD_BY_STREAK_DAY[(streakDay - 1) % DAILY_REWARD_BY_STREAK_DAY.length];
}

interface PersistedShape {
  balance: number;
  /** Local YYYY-MM-DD of the last successful daily claim, or null before the first one. */
  lastClaimDate: string | null;
  /** Length of the current unbroken daily-claim streak (>=1 once any claim has happened). */
  streakDays: number;
}

/** New installs start with exactly 2 hints -- the first launch is not a daily
 * claim (see `resolveLaunchClaim`), so the first gift arrives on day 2. */
const STARTING_BALANCE = 2;

function defaultState(): PersistedShape {
  return { balance: STARTING_BALANCE, lastClaimDate: null, streakDays: 0 };
}

function sanitizePersisted(parsed: Partial<PersistedShape> | null): PersistedShape {
  if (!parsed) return defaultState();
  return {
    balance: typeof parsed.balance === 'number' && Number.isFinite(parsed.balance) ? parsed.balance : 0,
    lastClaimDate: typeof parsed.lastClaimDate === 'string' ? parsed.lastClaimDate : null,
    streakDays: typeof parsed.streakDays === 'number' && Number.isFinite(parsed.streakDays) ? parsed.streakDays : 0,
  };
}

/** Local calendar date, not UTC -- claiming resets at the player's own midnight. */
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Whole-calendar-day gap between two YYYY-MM-DD keys -- via `Date` diff rather
 * than string comparison so month/year boundaries (and DST) aren't a special case. */
function daysBetween(fromKey: string, toKey: string): number {
  const from = new Date(`${fromKey}T00:00:00`);
  const to = new Date(`${toKey}T00:00:00`);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

interface LaunchResolution {
  state: PersistedShape;
  /** The claim granted on this launch, or null when nothing was granted. */
  claim: { reward: number; streakDays: number } | null;
}

/**
 * Pure: decides what a launch on `today` does to the persisted wallet.
 * - First-ever launch (no `lastClaimDate`): no gift, just stamps today so the
 *   next calendar day becomes streak day 1 -- the player keeps the starting
 *   balance and the gift alert first shows on day 2.
 * - Already claimed today: no-op.
 * - Otherwise: a claim yesterday extends the streak, a gap restarts it at 1.
 * `force` (testing only) claims every launch and always counts as consecutive,
 * so relaunching cycles through the whole reward table.
 */
function resolveLaunchClaim(current: PersistedShape, today: string, force: boolean): LaunchResolution {
  if (!force && current.lastClaimDate === null) {
    return { state: { ...current, lastClaimDate: today, streakDays: 0 }, claim: null };
  }
  if (!force && current.lastClaimDate === today) {
    return { state: current, claim: null };
  }
  const consecutive = force || (current.lastClaimDate !== null && daysBetween(current.lastClaimDate, today) === 1);
  const streakDays = consecutive ? current.streakDays + 1 : 1;
  const reward = rewardForStreakDay(streakDays);
  return {
    state: { balance: current.balance + reward, lastClaimDate: today, streakDays },
    claim: { reward, streakDays },
  };
}

interface HintWalletContextValue {
  ready: boolean;
  /** Shared across every game -- there's one hint economy, not one per game. */
  balance: number;
  /** Set to that claim's reward exactly once per successful daily claim, until
   * acknowledged -- the Library screen surfaces it as an alert, then clears
   * it so it doesn't reappear on every remount this session. */
  pendingDailyClaim: number | null;
  /** The streak day (1-indexed) that produced `pendingDailyClaim`'s reward --
   * present whenever `pendingDailyClaim` is, for the "day N streak" copy. */
  pendingStreakDays: number | null;
  acknowledgeDailyClaim: () => void;
  /** Spends 1 hint if the balance allows it; returns false (no-op) at 0. */
  spendHint: () => boolean;
  /** Grants 1 hint outright -- used to refund a spend that turned out to be a
   * no-op (nothing left to hint) and after a rewarded-ad watch. */
  grantHint: () => void;
}

const HintWalletContext = createContext<HintWalletContextValue | null>(null);

export function HintWalletProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PersistedShape>(defaultState);
  const [ready, setReady] = useState(false);
  const [pendingDailyClaim, setPendingDailyClaim] = useState<number | null>(null);
  const [pendingStreakDays, setPendingStreakDays] = useState<number | null>(null);
  const loadedOnce = useRef(false);
  // Mirrors `state` but updated synchronously (ahead of React's re-render),
  // same rationale as every other progress hook in this app: back-to-back
  // spend/grant calls in one tick must both see fresh data.
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as Partial<PersistedShape>) : null;
        const { state: resolved, claim } = resolveLaunchClaim(
          sanitizePersisted(parsed),
          todayKey(),
          FORCE_DAILY_CLAIM_FOR_TESTING
        );

        if (claim) {
          setPendingDailyClaim(claim.reward);
          setPendingStreakDays(claim.streakDays);
        }

        stateRef.current = resolved;
        setState(resolved);
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

  const spendHint = useCallback((): boolean => {
    const current = stateRef.current;
    if (current.balance <= 0) return false;
    const next: PersistedShape = { ...current, balance: current.balance - 1 };
    stateRef.current = next;
    setState(next);
    return true;
  }, []);

  const grantHint = useCallback(() => {
    const current = stateRef.current;
    const next: PersistedShape = { ...current, balance: current.balance + 1 };
    stateRef.current = next;
    setState(next);
  }, []);

  const acknowledgeDailyClaim = useCallback(() => {
    setPendingDailyClaim(null);
    setPendingStreakDays(null);
  }, []);

  const value = useMemo<HintWalletContextValue>(
    () => ({ ready, balance: state.balance, pendingDailyClaim, pendingStreakDays, acknowledgeDailyClaim, spendHint, grantHint }),
    [ready, state.balance, pendingDailyClaim, pendingStreakDays, acknowledgeDailyClaim, spendHint, grantHint]
  );

  return React.createElement(HintWalletContext.Provider, { value }, children);
}

export function useHintWallet(): HintWalletContextValue {
  const ctx = useContext(HintWalletContext);
  if (!ctx) throw new Error('useHintWallet must be used within a HintWalletProvider');
  return ctx;
}
