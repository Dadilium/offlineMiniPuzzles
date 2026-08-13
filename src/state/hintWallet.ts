import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = '@signal-arcade/hints/wallet/v1';

// TEMP(testing): forces the daily-gift claim on every launch, ignoring
// `lastClaimDate`, so the new DailyGiftModal can be eyeballed repeatedly.
// Flip back to false before shipping.
const FORCE_DAILY_CLAIM_FOR_TESTING = false;

/** Hints granted to the wallet on the first app open of a new calendar day. */
export const DAILY_HINT_REWARD = 2;

interface PersistedShape {
  balance: number;
  /** Local YYYY-MM-DD of the last successful daily claim, or null before the first one. */
  lastClaimDate: string | null;
}

function defaultState(): PersistedShape {
  return { balance: 0, lastClaimDate: null };
}

function sanitizePersisted(parsed: Partial<PersistedShape> | null): PersistedShape {
  if (!parsed) return defaultState();
  return {
    balance: typeof parsed.balance === 'number' && Number.isFinite(parsed.balance) ? parsed.balance : 0,
    lastClaimDate: typeof parsed.lastClaimDate === 'string' ? parsed.lastClaimDate : null,
  };
}

/** Local calendar date, not UTC -- claiming resets at the player's own midnight. */
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface HintWalletContextValue {
  ready: boolean;
  /** Shared across every game -- there's one hint economy, not one per game. */
  balance: number;
  /** Set to `DAILY_HINT_REWARD` exactly once per successful daily claim, until
   * acknowledged -- the Library screen surfaces it as an alert, then clears
   * it so it doesn't reappear on every remount this session. */
  pendingDailyClaim: number | null;
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
          sanitized = { balance: sanitized.balance + DAILY_HINT_REWARD, lastClaimDate: today };
          setPendingDailyClaim(DAILY_HINT_REWARD);
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

  const acknowledgeDailyClaim = useCallback(() => setPendingDailyClaim(null), []);

  const value = useMemo<HintWalletContextValue>(
    () => ({ ready, balance: state.balance, pendingDailyClaim, acknowledgeDailyClaim, spendHint, grantHint }),
    [ready, state.balance, pendingDailyClaim, acknowledgeDailyClaim, spendHint, grantHint]
  );

  return React.createElement(HintWalletContext.Provider, { value }, children);
}

export function useHintWallet(): HintWalletContextValue {
  const ctx = useContext(HintWalletContext);
  if (!ctx) throw new Error('useHintWallet must be used within a HintWalletProvider');
  return ctx;
}
