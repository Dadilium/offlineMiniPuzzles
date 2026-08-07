import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect } from 'react';
import { useInterstitialAd } from 'react-native-google-mobile-ads';
import {
  adUnitIds,
  DEFAULT_INTERSTITIAL_STATE,
  interstitialScheduleFor,
  nextInterstitialDecision,
  type GameId,
  type InterstitialSchedule,
  type InterstitialState,
} from '../config/ads';

const STORAGE_KEY_PREFIX = '@signal-arcade/ads/interstitial-state/';

async function readState(storageKey: string): Promise<InterstitialState> {
  const raw = await AsyncStorage.getItem(storageKey);
  if (!raw) return DEFAULT_INTERSTITIAL_STATE;
  try {
    return { ...DEFAULT_INTERSTITIAL_STATE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_INTERSTITIAL_STATE;
  }
}

function writeState(storageKey: string, state: InterstitialState): Promise<void> {
  return AsyncStorage.setItem(storageKey, JSON.stringify(state));
}

/**
 * Shared plumbing behind useInterstitialOnComplete and useInterstitialOnAction:
 * shows an interstitial on the cadence from `schedule` (a grace period of
 * genuine trigger events, then a fixed interval after that), tracked against
 * its own `storageKey` -- so two different triggers on the same game (e.g.
 * level completions vs. an in-level assist action) never share, or fight
 * over, the same counter.
 *
 * An ad attempt only counts once it's actually watched through to close --
 * if it wasn't loaded, or the app is killed mid-ad, the very next trigger
 * retries immediately rather than waiting for the schedule to come back
 * around.
 */
function useInterstitialCadence(storageKey: string, schedule: InterstitialSchedule) {
  const { isLoaded, isClosed, load, show } = useInterstitialAd(adUnitIds.interstitial);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!isClosed) return;
    readState(storageKey).then((state) => {
      if (!state.pendingRetry) return;
      return writeState(storageKey, { sinceLastAd: 0, everShownAd: true, pendingRetry: false });
    });
    load();
  }, [isClosed, storageKey, load]);

  const notify = useCallback(
    (opts?: { forceDue?: boolean }) => {
      readState(storageKey).then(async (state) => {
        const { due, sinceLastAd } = nextInterstitialDecision(state, schedule, opts?.forceDue ?? false);

        if (!due) {
          await writeState(storageKey, { ...state, sinceLastAd });
          return;
        }

        // Mark the attempt in-flight before showing -- whether or not it was
        // actually loaded -- so a kill mid-ad or a no-fill both force a retry
        // on the next trigger instead of silently resuming the schedule.
        await writeState(storageKey, { sinceLastAd, everShownAd: state.everShownAd, pendingRetry: true });
        if (isLoaded) show();
      });
    },
    [storageKey, schedule, isLoaded, show]
  );

  return { notify };
}

/** Shows an interstitial on the cadence from `interstitialScheduleFor(gameId)`.
 * Call `notifyLevelCompleted` once per win only -- never on skip, since Skip
 * Level already costs the player a rewarded ad. Pass `{ forceDue: true }` to
 * short-circuit straight to due regardless of the count-based schedule (e.g.
 * Matching Numbers uses this when a level took unusually long to solve). */
export function useInterstitialOnComplete(gameId: GameId) {
  const { notify } = useInterstitialCadence(STORAGE_KEY_PREFIX + gameId, interstitialScheduleFor(gameId));
  const notifyLevelCompleted = useCallback((opts?: { forceDue?: boolean }) => notify(opts), [notify]);
  return { notifyLevelCompleted };
}

/** Same idea as useInterstitialOnComplete, but for any other cadence-tracked
 * in-level action (i.e. anything besides "completed a level") -- e.g.
 * Matching Numbers' Add Numbers assist, shown every other press. `actionKey`
 * namespaces the counter so it never shares state with the level-completion
 * cadence or any other action on the same game. */
export function useInterstitialOnAction(gameId: GameId, actionKey: string, schedule: InterstitialSchedule) {
  const { notify } = useInterstitialCadence(`${STORAGE_KEY_PREFIX}${gameId}:${actionKey}`, schedule);
  const notifyAction = useCallback(() => notify(), [notify]);
  return { notifyAction };
}
