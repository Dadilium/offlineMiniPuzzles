import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { msUntilNextLocalMidnight, todayDayNumber } from './calendar';
import {
  addElapsed,
  addHint,
  allSolvedDays,
  defaultResults,
  entryFor,
  markSolved,
  sanitizeResults,
  solvedDays,
  type DailyEntry,
  type DailyResultsState,
} from './dailyResults';
import { computeStreak, unionDays, type Streak } from './streaks';

const STORAGE_KEY = '@signal-arcade/daily/results/v1';

interface DailyResultsContextValue {
  ready: boolean;
  /** Today's puzzle number -- re-read on foreground and at local midnight. */
  today: number;
  entryFor: (gameId: string, day: number) => DailyEntry;
  addElapsed: (gameId: string, day: number, ms: number) => void;
  addHint: (gameId: string, day: number) => void;
  markSolved: (gameId: string, day: number, finalElapsedMs: number) => void;
  streakFor: (gameId: string) => Streak;
  overallStreak: Streak;
}

const DailyResultsContext = createContext<DailyResultsContextValue | null>(null);

/** Tracks the current puzzle number, rolling over at local midnight even if the app is never backgrounded. */
function useTodayDayNumber(): number {
  const [today, setToday] = useState(todayDayNumber);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => setToday(todayDayNumber());
    const schedule = () => {
      timer = setTimeout(() => {
        refresh();
        schedule();
      }, msUntilNextLocalMidnight());
    };
    schedule();
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      refresh();
      clearTimeout(timer);
      schedule();
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, []);
  return today;
}

export function DailyResultsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DailyResultsState>(defaultResults);
  const [ready, setReady] = useState(false);
  const loadedOnce = useRef(false);
  // Synchronous mirror, same rationale as createProgressStore: a flush of
  // elapsed time and a solve can land in the same tick.
  const stateRef = useRef(state);
  stateRef.current = state;
  const today = useTodayDayNumber();

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const loaded = sanitizeResults(raw ? JSON.parse(raw) : null);
        stateRef.current = loaded;
        setState(loaded);
      } catch {
        // corrupt/missing storage -- fall back to defaults, already set
      } finally {
        loadedOnce.current = true;
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loadedOnce.current) return;
    let serialized: string;
    try {
      serialized = JSON.stringify(state);
    } catch {
      return;
    }
    AsyncStorage.setItem(STORAGE_KEY, serialized).catch(() => {});
  }, [state]);

  const apply = useCallback((transition: (s: DailyResultsState) => DailyResultsState) => {
    const next = transition(stateRef.current);
    if (next === stateRef.current) return;
    stateRef.current = next;
    setState(next);
  }, []);

  const value = useMemo<DailyResultsContextValue>(() => {
    const overallStreak = computeStreak(unionDays(allSolvedDays(state)), today);
    return {
      ready,
      today,
      // Reads the synchronous mirror so a solve recorded right after a
      // time flush (same tick, before re-render) sees that flushed time.
      entryFor: (gameId, day) => entryFor(stateRef.current, gameId, day),
      addElapsed: (gameId, day, ms) => apply((s) => addElapsed(s, gameId, day, ms)),
      addHint: (gameId, day) => apply((s) => addHint(s, gameId, day)),
      markSolved: (gameId, day, finalElapsedMs) => apply((s) => markSolved(s, gameId, day, finalElapsedMs)),
      streakFor: (gameId) => computeStreak(solvedDays(state, gameId), today),
      overallStreak,
    };
  }, [state, ready, today, apply]);

  return <DailyResultsContext.Provider value={value}>{children}</DailyResultsContext.Provider>;
}

export function useDailyResults(): DailyResultsContextValue {
  const ctx = useContext(DailyResultsContext);
  if (!ctx) throw new Error('useDailyResults must be used within a DailyResultsProvider');
  return ctx;
}
