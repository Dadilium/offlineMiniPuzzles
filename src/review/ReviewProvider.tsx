import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { Linking, Platform } from 'react-native';
import { ANDROID_STORE_URL, ANDROID_STORE_WEB_URL, IOS_WRITE_REVIEW_URL } from '../config/links';
import { posthog } from '../config/posthog';
import { useDailyResults } from '../daily/DailyResultsProvider';
import { onLevelCompleted } from '../state/levelEvents';
import {
  applyReviewEvent,
  defaultReviewState,
  sanitizeReviewState,
  shouldPresentReview,
  withFirstSeen,
  withPromptShown,
  type ReviewEvent,
  type ReviewState,
} from './reviewRules';

// A static `import` throws at bundle-evaluation time if the native module
// isn't linked into the running binary -- and an OTA update can reach an
// older binary that predates expo-store-review. Same guard as
// startup/version.ts: without it, only the in-app ask is lost (the Settings
// "Rate" row opens the store page directly and keeps working).
let StoreReview: typeof import('expo-store-review') | null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  StoreReview = require('expo-store-review');
} catch {
  StoreReview = null;
}

const STORAGE_KEY = '@signal-arcade/review/v1';

interface ReviewContextValue {
  /** Called by the win screen once it's on screen: shows the OS review sheet if a milestone made one owed. */
  presentIfOwed: () => void;
  /** Settings "Rate Puzzle Den": straight to the store's write-a-review page. */
  openStoreReviewPage: () => void;
}

const ReviewContext = createContext<ReviewContextValue | null>(null);

/**
 * Owns the store-rating ask: folds every positive event (clean Hard/Expert
 * wins from any game, daily-streak milestones) into the pure rules in
 * reviewRules.ts, persists that state, and presents the OS sheet on the next
 * win screen when one is owed.
 */
export function ReviewProvider({ children }: { children: React.ReactNode }) {
  const results = useDailyResults();
  const stateRef = useRef<ReviewState>(defaultReviewState());
  const loaded = useRef(false);
  // Events can arrive before storage has loaded (a win in the first second
  // is unlikely, but a daily streak is known right at launch) -- buffered
  // and replayed once the persisted state is in.
  const pending = useRef<ReviewEvent[]>([]);

  const persist = useCallback(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stateRef.current)).catch(() => {});
  }, []);

  const apply = useCallback(
    (event: ReviewEvent) => {
      if (!loaded.current) {
        pending.current.push(event);
        return;
      }
      const next = applyReviewEvent(stateRef.current, event, Date.now());
      if (next === stateRef.current) return;
      if (next.owed && !stateRef.current.owed) posthog?.capture('review_owed', { trigger: event.type });
      stateRef.current = next;
      persist();
    },
    [persist]
  );

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        stateRef.current = sanitizeReviewState(raw ? JSON.parse(raw) : null);
      } catch {
        // corrupt/missing storage -- defaults already set
      }
      stateRef.current = withFirstSeen(stateRef.current, Date.now());
      loaded.current = true;
      persist();
      const buffered = pending.current;
      pending.current = [];
      buffered.forEach(apply);
    })();
  }, [apply, persist]);

  useEffect(() => onLevelCompleted((event) => apply({ type: 'levelWin', ...event })), [apply]);

  const streak = results.overallStreak.current;
  useEffect(() => {
    if (results.ready && streak > 0) apply({ type: 'dailyStreak', streak });
  }, [results.ready, streak, apply]);

  const presentIfOwed = useCallback(() => {
    if (!loaded.current || !StoreReview) return;
    const now = Date.now();
    if (!shouldPresentReview(stateRef.current, now)) return;
    const reviewModule = StoreReview;
    reviewModule
      .isAvailableAsync()
      .then((available) => {
        if (!available) return;
        // Recorded before the request resolves: the OS gives no signal about
        // whether its sheet actually appeared (it may silently throttle), so
        // a request counts as an ask either way.
        stateRef.current = withPromptShown(stateRef.current, now);
        persist();
        posthog?.capture('review_requested');
        return reviewModule.requestReview();
      })
      .catch(() => {});
  }, [persist]);

  const openStoreReviewPage = useCallback(() => {
    posthog?.capture('review_settings_opened');
    if (Platform.OS === 'ios') {
      Linking.openURL(IOS_WRITE_REVIEW_URL).catch(() => {});
      return;
    }
    Linking.openURL(ANDROID_STORE_URL).catch(() => Linking.openURL(ANDROID_STORE_WEB_URL).catch(() => {}));
  }, []);

  const value = useMemo(() => ({ presentIfOwed, openStoreReviewPage }), [presentIfOwed, openStoreReviewPage]);
  return <ReviewContext.Provider value={value}>{children}</ReviewContext.Provider>;
}

export function useReview(): ReviewContextValue {
  const ctx = useContext(ReviewContext);
  if (!ctx) throw new Error('useReview must be used within a ReviewProvider');
  return ctx;
}
