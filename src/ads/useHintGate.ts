import { useCallback } from 'react';
import { useHintWallet } from '../state/hintWallet';
import { useRewardedHint } from './useRewardedHint';

interface UseHintGateResult {
  /** Wallet balance, for the Hint button's label. */
  hintCount: number;
  /** Call from the Hint button's `onPress`. Spends 1 from the shared wallet
   * (or, at 0, shows a rewarded ad) then runs `attemptHint`. */
  onHintPress: () => void;
  /** True once a rewarded ad is loaded and ready to show at 0 balance. */
  isHintAdReady: boolean;
}

/**
 * Gates every game's Hint button behind the shared global wallet
 * (`useHintWallet`) instead of each game giving hints for free/unlimited.
 * `attemptHint` stays each game's own existing hint logic (differs per
 * puzzle type -- reveals a cell, a move, a pair, etc.) and must return
 * whether a hint was actually granted. If it returns false (e.g. every cell
 * is already correct, or a color's hint budget is full), the spend/ad-watch
 * is refunded rather than consumed for nothing.
 */
export function useHintGate(attemptHint: () => boolean, onAdNotReady: () => void): UseHintGateResult {
  const { balance, spendHint, grantHint } = useHintWallet();

  const { requestHintAd, isAdReady } = useRewardedHint(() => {
    if (!attemptHint()) grantHint();
  });

  const onHintPress = useCallback(() => {
    if (balance > 0) {
      spendHint();
      if (!attemptHint()) grantHint();
      return;
    }
    if (isAdReady) requestHintAd();
    else onAdNotReady();
  }, [balance, spendHint, grantHint, attemptHint, isAdReady, requestHintAd, onAdNotReady]);

  return { hintCount: balance, onHintPress, isHintAdReady: isAdReady };
}
