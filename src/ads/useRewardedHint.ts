import { useCallback, useEffect, useRef } from 'react';
import { useRewardedAd } from 'react-native-google-mobile-ads';
import { adUnitIds } from '../config/ads';

interface UseRewardedHintResult {
  /** Shows the rewarded ad if one is loaded; does nothing (caller should
   * fall back to a toast) if it isn't ready yet. */
  requestHintAd: () => void;
  isAdReady: boolean;
}

/** Same shape as `useRewardedSkip` -- shares the single `rewarded` ad unit
 * since there's no separate hint-specific unit configured. Reloads
 * automatically after every close so the next request has an ad ready. */
export function useRewardedHint(onHintGranted: () => void): UseRewardedHintResult {
  const { isLoaded, isEarnedReward, isClosed, load, show } = useRewardedAd(adUnitIds.rewarded);
  const grantedRef = useRef(false);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (isEarnedReward && !grantedRef.current) {
      grantedRef.current = true;
      onHintGranted();
    }
  }, [isEarnedReward, onHintGranted]);

  useEffect(() => {
    if (isClosed) {
      grantedRef.current = false;
      load();
    }
  }, [isClosed, load]);

  const requestHintAd = useCallback(() => {
    if (isLoaded) show();
  }, [isLoaded, show]);

  return { requestHintAd, isAdReady: isLoaded };
}
