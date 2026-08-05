import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect } from 'react';
import { useInterstitialAd } from 'react-native-google-mobile-ads';
import {
  adUnitIds,
  DEFAULT_INTERSTITIAL_STATE,
  interstitialScheduleFor,
  nextInterstitialDecision,
  type GameId,
  type InterstitialState,
} from '../config/ads';

const STORAGE_KEY_PREFIX = '@signal-arcade/ads/interstitial-state/';

async function readState(gameId: GameId): Promise<InterstitialState> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY_PREFIX + gameId);
  if (!raw) return DEFAULT_INTERSTITIAL_STATE;
  try {
    return { ...DEFAULT_INTERSTITIAL_STATE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_INTERSTITIAL_STATE;
  }
}

function writeState(gameId: GameId, state: InterstitialState): Promise<void> {
  return AsyncStorage.setItem(STORAGE_KEY_PREFIX + gameId, JSON.stringify(state));
}

/** Shows an interstitial on the cadence from `interstitialScheduleFor(gameId)`
 * (a grace period of genuine level completions, then a fixed interval after
 * that). Call `notifyLevelCompleted` once per win only -- never on skip,
 * since Skip Level already costs the player a rewarded ad.
 *
 * An ad attempt only counts once it's actually watched through to close --
 * if it wasn't loaded, or the app is killed mid-ad, the very next
 * completion retries immediately rather than waiting for the schedule to
 * come back around. */
export function useInterstitialOnComplete(gameId: GameId) {
  const { isLoaded, isClosed, load, show } = useInterstitialAd(adUnitIds.interstitial);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!isClosed) return;
    readState(gameId).then((state) => {
      if (!state.pendingRetry) return;
      return writeState(gameId, { sinceLastAd: 0, everShownAd: true, pendingRetry: false });
    });
    load();
  }, [isClosed, gameId, load]);

  const notifyLevelCompleted = useCallback(() => {
    readState(gameId).then(async (state) => {
      const schedule = interstitialScheduleFor(gameId);
      const { due, sinceLastAd } = nextInterstitialDecision(state, schedule);

      if (!due) {
        await writeState(gameId, { ...state, sinceLastAd });
        return;
      }

      // Mark the attempt in-flight before showing -- whether or not it was
      // actually loaded -- so a kill mid-ad or a no-fill both force a retry
      // on the next completion instead of silently resuming the schedule.
      await writeState(gameId, { sinceLastAd, everShownAd: state.everShownAd, pendingRetry: true });
      if (isLoaded) show();
    });
  }, [gameId, isLoaded, show]);

  return { notifyLevelCompleted };
}
