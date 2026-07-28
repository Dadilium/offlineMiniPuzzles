import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { findHintCell } from '../engine';
import { levels } from '../levels';
import type { PlacedRelay, RelayKind, SignalColor } from '../types';

export interface HintResult {
  outcome: 'placed' | 'solved' | 'budget-full';
  color?: SignalColor;
}

const STORAGE_KEY = '@signal-arcade/relay/progress/v1';

interface PersistedShape {
  relaysByLevel: PlacedRelay[][];
  levelsCompleted: number[];
  levelsSkipped: number[];
  tutorialsSeen: string[];
}

function defaultState(): PersistedShape {
  return {
    relaysByLevel: levels.map(() => []),
    levelsCompleted: [],
    levelsSkipped: [],
    tutorialsSeen: [],
  };
}

interface RelayProgressContextValue {
  ready: boolean;
  relaysByLevel: PlacedRelay[][];
  levelsCompleted: Set<number>;
  levelsSkipped: Set<number>;
  tutorialsSeen: Set<string>;
  toggleRelay: (
    levelIndex: number,
    x: number,
    y: number,
    color: SignalColor,
    budget: number,
    kind: RelayKind
  ) => 'placed' | 'removed' | 'budget-full' | 'locked';
  giveHint: (levelIndex: number) => HintResult;
  resetLevel: (levelIndex: number) => void;
  markLevelComplete: (levelIndex: number) => void;
  markLevelSkipped: (levelIndex: number) => void;
  markTutorialSeen: (key: string) => void;
  /** Wipes all relay placements, level completion/skip state, and seen tutorials -- for testing the first-run/tutorial flow again. */
  resetAllProgress: () => void;
}

const RelayProgressContext = createContext<RelayProgressContextValue | null>(null);

export function RelayProgressProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PersistedShape>(defaultState);
  const [ready, setReady] = useState(false);
  const loadedOnce = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as PersistedShape;
          // guard against a shorter/longer levels array from a future update
          const relaysByLevel = levels.map((_, i) => parsed.relaysByLevel?.[i] ?? []);
          setState({
            relaysByLevel,
            levelsCompleted: parsed.levelsCompleted ?? [],
            levelsSkipped: parsed.levelsSkipped ?? [],
            tutorialsSeen: parsed.tutorialsSeen ?? [],
          });
        }
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

  const toggleRelay = useCallback(
    (levelIndex: number, x: number, y: number, color: SignalColor, budget: number, kind: RelayKind) => {
      let outcome: 'placed' | 'removed' | 'budget-full' | 'locked' = 'placed';
      setState((prev) => {
        const relays = prev.relaysByLevel[levelIndex] ?? [];
        const existingIdx = relays.findIndex((r) => r.x === x && r.y === y);
        let nextRelays: PlacedRelay[];
        if (existingIdx >= 0) {
          if (relays[existingIdx].locked) {
            outcome = 'locked';
            return prev;
          }
          nextRelays = relays.slice(0, existingIdx).concat(relays.slice(existingIdx + 1));
          outcome = 'removed';
        } else {
          const used = relays.filter((r) => r.color === color).length;
          if (used >= budget) {
            outcome = 'budget-full';
            return prev;
          }
          nextRelays = relays.concat([{ x, y, color, kind }]);
          outcome = 'placed';
        }
        const relaysByLevel = prev.relaysByLevel.slice();
        relaysByLevel[levelIndex] = nextRelays;
        return { ...prev, relaysByLevel };
      });
      return outcome;
    },
    []
  );

  /**
   * Reveals one relay toward whichever source/receiver pair isn't connected
   * yet, as a locked hint piece. If every color needing help is already at
   * its placement budget, no piece is added -- the caller should tell the
   * player to free up a relay first.
   */
  const giveHint = useCallback(
    (levelIndex: number): HintResult => {
      const level = levels[levelIndex];
      const relays = state.relaysByLevel[levelIndex] ?? [];
      let budgetBlockedColor: SignalColor | undefined;

      for (const source of level.sources) {
        const color = source.color;
        const cell = findHintCell(level, relays, color);
        if (!cell) continue; // already connected

        const used = relays.filter((r) => r.color === color).length;
        const budget = level.budgets[color] ?? 0;
        if (used >= budget) {
          budgetBlockedColor = budgetBlockedColor ?? color;
          continue;
        }

        setState((prev) => {
          const prevRelays = prev.relaysByLevel[levelIndex] ?? [];
          const relaysByLevel = prev.relaysByLevel.slice();
          relaysByLevel[levelIndex] = prevRelays.concat([{ x: cell.x, y: cell.y, color, locked: true, kind: cell.kind }]);
          return { ...prev, relaysByLevel };
        });
        return { outcome: 'placed', color };
      }

      if (budgetBlockedColor) return { outcome: 'budget-full', color: budgetBlockedColor };
      return { outcome: 'solved' };
    },
    [state]
  );

  const resetLevel = useCallback((levelIndex: number) => {
    setState((prev) => {
      const relaysByLevel = prev.relaysByLevel.slice();
      relaysByLevel[levelIndex] = [];
      return { ...prev, relaysByLevel };
    });
  }, []);

  const markLevelComplete = useCallback((levelIndex: number) => {
    setState((prev) => {
      if (prev.levelsCompleted.includes(levelIndex)) return prev;
      return { ...prev, levelsCompleted: prev.levelsCompleted.concat(levelIndex) };
    });
  }, []);

  /** Marks a level skipped (via ad) so the next level unlocks -- distinct from actually solving it. */
  const markLevelSkipped = useCallback((levelIndex: number) => {
    setState((prev) => {
      if (prev.levelsCompleted.includes(levelIndex) || prev.levelsSkipped.includes(levelIndex)) return prev;
      return { ...prev, levelsSkipped: prev.levelsSkipped.concat(levelIndex) };
    });
  }, []);

  const markTutorialSeen = useCallback((key: string) => {
    setState((prev) => {
      if (prev.tutorialsSeen.includes(key)) return prev;
      return { ...prev, tutorialsSeen: prev.tutorialsSeen.concat(key) };
    });
  }, []);

  const resetAllProgress = useCallback(() => {
    setState(defaultState());
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  const value = useMemo<RelayProgressContextValue>(
    () => ({
      ready,
      relaysByLevel: state.relaysByLevel,
      levelsCompleted: new Set(state.levelsCompleted),
      levelsSkipped: new Set(state.levelsSkipped),
      tutorialsSeen: new Set(state.tutorialsSeen),
      toggleRelay,
      giveHint,
      resetLevel,
      markLevelComplete,
      markLevelSkipped,
      markTutorialSeen,
      resetAllProgress,
    }),
    [ready, state, toggleRelay, giveHint, resetLevel, markLevelComplete, markLevelSkipped, markTutorialSeen, resetAllProgress]
  );

  return React.createElement(RelayProgressContext.Provider, { value }, children);
}

export function useRelayProgress(): RelayProgressContextValue {
  const ctx = useContext(RelayProgressContext);
  if (!ctx) throw new Error('useRelayProgress must be used within a RelayProgressProvider');
  return ctx;
}
