import { useCallback } from 'react';
import { StackActions, useNavigation } from '@react-navigation/native';

/** Where a daily was opened from -- Done and back return the player there. */
export type DailyOrigin = 'hub' | 'library';

/**
 * Exit for a game screen: back to the Library when this daily was opened
 * from the Library's Today strip, otherwise back to the game's hub (regular
 * levels and hub-launched dailies). `popTo`, not `goBack`, so a tutorial
 * replayed mid-level never leaves a stale game screen underneath.
 */
export function useExitToOrigin(daily: DailyOrigin | undefined, hubRoute: string): () => void {
  const navigation = useNavigation();
  return useCallback(() => {
    navigation.dispatch(StackActions.popTo(daily === 'library' ? 'Library' : hubRoute));
  }, [navigation, daily, hubRoute]);
}
