import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { dateKey, defaultState, resolveLaunchClaim, sanitizePersisted, type PersistedShape } from './dailyReward';

const STORAGE_KEY = '@signal-arcade/hints/wallet/v1';

// TEMP(testing): forces the daily-gift claim on every launch, ignoring
// `lastClaimDate`, so the new DailyGiftModal can be eyeballed repeatedly.
// Flip back to false before shipping.
const FORCE_DAILY_CLAIM_FOR_TESTING = false;

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
          dateKey(new Date()),
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
