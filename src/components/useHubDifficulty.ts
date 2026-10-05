import { useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { DifficultyControls } from '../state/createProgressStore';
import { nextTier, type DifficultyTier } from '../state/difficultyTiers';
import type { DifficultySelectorProps } from './DifficultySelector';
import { useToast } from './Toast';

/** Binds a game's difficulty controls to the hub's `DifficultySelector`.
 * Switching regenerates the next unplayed level, so if the player already
 * started it (hints spent or any board progress) they're asked first. */
export function useHubDifficulty(difficulty: DifficultyControls, resumeIdx: number): DifficultySelectorProps {
  const { t } = useTranslation('common');
  const { showToast } = useToast();
  const { tiers, selectedTier, unlockedTier, hasNewUnlock, setSelectedTier, isLevelStarted, markUnlockSeen } = difficulty;

  const onSelect = useCallback(
    (tier: DifficultyTier) => {
      if (!isLevelStarted(resumeIdx)) {
        setSelectedTier(tier);
        return;
      }
      Alert.alert(t('difficulty.confirmTitle'), t('difficulty.confirmMessage', { tier: t(`difficulty.tiers.${tier}`) }), [
        { text: t('difficulty.cancelAction'), style: 'cancel' },
        { text: t('difficulty.confirmAction'), style: 'destructive', onPress: () => setSelectedTier(tier) },
      ]);
    },
    [isLevelStarted, resumeIdx, setSelectedTier, t]
  );

  // Always names the very next tier to earn, even when a further one was
  // tapped -- tiers unlock one at a time, so that's the honest next goal.
  const onLockedPress = useCallback(() => {
    const target = nextTier(unlockedTier, tiers);
    if (!target) return;
    showToast(t('difficulty.lockedToast', { current: t(`difficulty.tiers.${unlockedTier}`), tier: t(`difficulty.tiers.${target}`) }));
  }, [showToast, t, tiers, unlockedTier]);

  return useMemo(
    () => ({ tiers, selectedTier, unlockedTier, hasNewUnlock, onSelect, onLockedPress, onUnlockSeen: markUnlockSeen }),
    [tiers, selectedTier, unlockedTier, hasNewUnlock, onSelect, onLockedPress, markUnlockSeen]
  );
}
