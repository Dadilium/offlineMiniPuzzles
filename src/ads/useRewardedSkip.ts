import { useCallback, useEffect, useRef } from 'react';
import { useRewardedAd } from 'react-native-google-mobile-ads';
import { adUnitIds } from '../config/ads';

interface UseRewardedSkipResult {
  /** Shows the rewarded ad if one is loaded; does nothing (caller should
   * fall back to a toast) if it isn't ready yet. */
  requestSkip: () => void;
  isAdReady: boolean;
}

/** Gates a "Skip Level" action behind a rewarded ad. `onSkipGranted` fires
 * exactly once per ad, only when the reward is actually earned -- closing
 * the ad early grants nothing. Reloads automatically after every close so
 * the next skip attempt has an ad ready. */
export function useRewardedSkip(onSkipGranted: () => void): UseRewardedSkipResult {
  const { isLoaded, isEarnedReward, isClosed, load, show } = useRewardedAd(adUnitIds.rewarded);
  const grantedRef = useRef(false);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (isEarnedReward && !grantedRef.current) {
      grantedRef.current = true;
      onSkipGranted();
    }
  }, [isEarnedReward, onSkipGranted]);

  useEffect(() => {
    if (isClosed) {
      grantedRef.current = false;
      load();
    }
  }, [isClosed, load]);

  const requestSkip = useCallback(() => {
    if (isLoaded) show();
  }, [isLoaded, show]);

  return { requestSkip, isAdReady: isLoaded };
}
