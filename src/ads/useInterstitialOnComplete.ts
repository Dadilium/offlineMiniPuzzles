import { useCallback, useEffect, useMemo } from 'react';
import { interstitialScheduleFor, type GameId } from '../config/ads';
import type { InterstitialSchedule } from './interstitialRules';
import { useInterstitials } from './InterstitialProvider';

const STORAGE_KEY_PREFIX = '@signal-arcade/ads/interstitial-state/';

/**
 * Counts level completions against `interstitialScheduleFor(gameId)`. A win
 * only *decides* the ad -- when due it's recorded as owed (persisted), and
 * shown at the start of the next level by `useInterstitialAtLevelStart`, so
 * it never covers the win celebration and closing the app in between only
 * defers it.
 *
 * Call `notifyLevelCompleted` once per first clear only -- never on skip
 * (Skip Level already costs a rewarded ad) or on replays. Pass
 * `{ forceDue: true }` to make it due regardless of the count-based
 * schedule (e.g. Matching Numbers when a level took unusually long).
 * `notifyLevelCompleted` has a stable identity.
 */
export function useInterstitialOnComplete(gameId: GameId) {
  const { recordTrigger } = useInterstitials();
  const schedule = useMemo(() => interstitialScheduleFor(gameId), [gameId]);
  const notifyLevelCompleted = useCallback(
    (opts?: { forceDue?: boolean }) => {
      recordTrigger(STORAGE_KEY_PREFIX + gameId, schedule, { game_id: gameId, trigger: 'level_complete' }, opts);
    },
    [recordTrigger, schedule, gameId]
  );
  return { notifyLevelCompleted };
}

/**
 * Shows any owed interstitial when a level starts -- the natural break
 * between levels. Owed ads are app-wide, so one earned in another game (or
 * in a session that ended before the next level) shows here too. Pass a key
 * that changes per level (e.g. the level index).
 */
export function useInterstitialAtLevelStart(levelKey: string | number | null) {
  const { presentOwed } = useInterstitials();
  useEffect(() => {
    if (levelKey === null) return;
    presentOwed();
  }, [levelKey, presentOwed]);
}

/** Same cadence idea as useInterstitialOnComplete, but for an in-level
 * action (e.g. Matching Numbers' Add Numbers assist, shown every other
 * press). The player chose to pause play here, so a due ad shows right away
 * rather than waiting for the next level. `actionKey` namespaces the
 * counter so it never shares state with level completions. */
export function useInterstitialOnAction(gameId: GameId, actionKey: string, schedule: InterstitialSchedule) {
  const { recordTrigger, presentOwed } = useInterstitials();
  const notifyAction = useCallback(() => {
    recordTrigger(`${STORAGE_KEY_PREFIX}${gameId}:${actionKey}`, schedule, { game_id: gameId, trigger: actionKey }).then(presentOwed);
  }, [recordTrigger, presentOwed, gameId, actionKey, schedule]);
  return { notifyAction };
}
