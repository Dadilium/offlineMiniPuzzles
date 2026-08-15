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

function defaultState(): PersistedShape {
  return { balance: 0, lastClaimDate: null, streakDays: 0 };
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
        let sanitized = sanitizePersisted(parsed);

        const today = todayKey();
        if (FORCE_DAILY_CLAIM_FOR_TESTING || sanitized.lastClaimDate !== today) {
          // A claim yesterday extends the streak; anything else (a gap, or no
          // prior claim at all) starts a fresh one at day 1. Forced-testing
          // claims count as consecutive too, so relaunching cycles through
          // the whole reward table instead of sitting on day 1 forever.
          const consecutive =
            FORCE_DAILY_CLAIM_FOR_TESTING || (sanitized.lastClaimDate !== null && daysBetween(sanitized.lastClaimDate, today) === 1);
          const streakDays = consecutive ? sanitized.streakDays + 1 : 1;
          const reward = rewardForStreakDay(streakDays);
          sanitized = { balance: sanitized.balance + reward, lastClaimDate: today, streakDays };
          setPendingDailyClaim(reward);
          setPendingStreakDays(streakDays);
        }

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
