import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { useInterstitialAd } from 'react-native-google-mobile-ads';
import { posthog } from '../config/posthog';
import { useLatestRef } from '../utils/useLatestRef';
import { adUnitIds, initAds } from '../config/ads';
import {
  DEFAULT_INTERSTITIAL_STATE,
  isInterstitialCoolingDown,
  nextInterstitialDecision,
  SETTLED_INTERSTITIAL_STATE,
  withOwedTrigger,
  withoutWatched,
  type InterstitialSchedule,
  type InterstitialState,
  type OwedInterstitial,
} from './interstitialRules';

type AnalyticsContext = Record<string, string>;

const OWED_KEY = '@signal-arcade/ads/interstitial-owed';
// App-wide, not per game -- the cooldown spans every interstitial trigger.
const LAST_SHOWN_AT_KEY = '@signal-arcade/ads/interstitial-last-shown-at';

async function readJson<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function readState(storageKey: string): Promise<InterstitialState> {
  const parsed = await readJson<Partial<InterstitialState>>(storageKey);
  return { ...DEFAULT_INTERSTITIAL_STATE, ...parsed };
}

function writeState(storageKey: string, state: InterstitialState): Promise<void> {
  return AsyncStorage.setItem(storageKey, JSON.stringify(state));
}

async function readLastShownAt(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(LAST_SHOWN_AT_KEY);
  const parsed = raw === null ? NaN : Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

interface InterstitialContextValue {
  /** Counts one trigger event against the cadence at `storageKey`. When it
   * comes due, the ad is recorded as owed (not shown) -- `presentOwed` shows
   * it at the next natural break. */
  recordTrigger: (storageKey: string, schedule: InterstitialSchedule, context: AnalyticsContext, opts?: { forceDue?: boolean }) => Promise<void>;
  /** Shows the owed ad, if there is one, it's loaded, and the app-wide
   * cooldown has passed. Otherwise it stays owed for the next call. */
  presentOwed: () => Promise<void>;
}

const InterstitialContext = createContext<InterstitialContextValue | null>(null);

/**
 * Single app-wide interstitial. Lives at the root rather than in each game
 * screen because the ad is shown at the *start* of the next level -- a
 * freshly mounted screen (next level uses `navigation.replace`) would only
 * just have started loading its own ad. Here it loads once Mobile Ads is
 * initialized (after consent/ATT), stays ready across screens, and reloads
 * after every close.
 */
export function InterstitialProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isClosed, error, load, show } = useInterstitialAd(adUnitIds.interstitial);
  // Read through a ref so `presentOwed` keeps a stable identity -- callers
  // run it from a per-level effect, and a changing identity would re-run
  // that effect mid-level and could pop an ad during play.
  const adRef = useLatestRef({ isLoaded, load, show });

  // The owed ad currently on screen, so its close can settle exactly the
  // counters it covered (not ones that came due while it was showing).
  const presentingRef = useRef<OwedInterstitial | null>(null);
  // Serializes storage read-modify-writes so a trigger and a present racing
  // on the same tick can't overwrite each other's owed record.
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const enqueue = useCallback((task: () => Promise<void>): Promise<void> => {
    const next = queueRef.current.then(task, task);
    queueRef.current = next.catch(() => {});
    return next;
  }, []);

  useEffect(() => {
    // Never request an ad before consent/ATT have settled.
    initAds()
      .catch(() => {})
      .finally(() => adRef.current.load());
  }, [adRef]);

  useEffect(() => {
    if (!isClosed) return;
    const watched = presentingRef.current;
    presentingRef.current = null;
    adRef.current.load();
    if (!watched) return;
    enqueue(async () => {
      await Promise.all(watched.storageKeys.map((key) => writeState(key, SETTLED_INTERSTITIAL_STATE)));
      const remaining = withoutWatched(await readJson<OwedInterstitial>(OWED_KEY), watched);
      await (remaining ? AsyncStorage.setItem(OWED_KEY, JSON.stringify(remaining)) : AsyncStorage.removeItem(OWED_KEY));
    });
  }, [isClosed, adRef, enqueue]);

  // A failed show (e.g. the loaded ad expired) never reaches `isClosed` --
  // release the in-flight marker so the still-owed ad can be retried.
  useEffect(() => {
    if (!error) return;
    presentingRef.current = null;
  }, [error]);

  const recordTrigger = useCallback<InterstitialContextValue['recordTrigger']>(
    (storageKey, schedule, context, opts) =>
      enqueue(async () => {
        const state = await readState(storageKey);
        const { due, sinceLastAd } = nextInterstitialDecision(state, schedule, opts?.forceDue ?? false);
        if (!due) {
          await writeState(storageKey, { ...state, sinceLastAd });
          return;
        }
        const owed = await readJson<OwedInterstitial>(OWED_KEY);
        await writeState(storageKey, { sinceLastAd, everShownAd: state.everShownAd, pendingRetry: true });
        await AsyncStorage.setItem(OWED_KEY, JSON.stringify(withOwedTrigger(owed, storageKey, context)));
      }),
    [enqueue]
  );

  const presentOwed = useCallback<InterstitialContextValue['presentOwed']>(
    () =>
      enqueue(async () => {
        if (presentingRef.current) return;
        const [owed, lastShownAt] = await Promise.all([readJson<OwedInterstitial>(OWED_KEY), readLastShownAt()]);
        if (!owed || owed.storageKeys.length === 0) return;

        const now = Date.now();
        if (isInterstitialCoolingDown(lastShownAt, now)) {
          // Lets the cooldown length be tuned from data: how often an owed
          // ad is actually being deferred by it.
          posthog?.capture('ad_interstitial_cooldown_skip', owed.context);
          return;
        }
        if (!adRef.current.isLoaded) {
          // Owed, but nothing was ready to show -- stays owed for the next
          // level start. Distinguishes "never due" from "due but no fill".
          posthog?.capture('ad_interstitial_no_fill', owed.context);
          adRef.current.load();
          return;
        }

        presentingRef.current = owed;
        await AsyncStorage.setItem(LAST_SHOWN_AT_KEY, String(now));
        posthog?.capture('ad_interstitial_shown', owed.context);
        adRef.current.show();
      }),
    [enqueue, adRef]
  );

  const value = useMemo(() => ({ recordTrigger, presentOwed }), [recordTrigger, presentOwed]);
  return <InterstitialContext.Provider value={value}>{children}</InterstitialContext.Provider>;
}

export function useInterstitials(): InterstitialContextValue {
  const ctx = useContext(InterstitialContext);
  if (!ctx) throw new Error('useInterstitials must be used within an InterstitialProvider');
  return ctx;
}
