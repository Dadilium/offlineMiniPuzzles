import React from 'react';
import type { ProgressStoreConfig } from '../state/createProgressStore';
import { dailyRating, dailySeedIndex, tierForDayNumber, todayDayNumber } from './calendar';

/**
 * A game's regular robust generator: `(levelIndex, skillRating,
 * recentFingerprints) => level`. Every one of these is already a pure
 * function of its inputs (seeded from `levelIndex`, fallbacks re-seed at the
 * same tier), so fed a fixed seed index, a fixed rating and *no* per-player
 * history it builds the same board on every device.
 */
type RobustGenerator<TLevel> = (levelIndex: number, skillRating: number, recentFingerprints: string[]) => TLevel | Promise<TLevel>;

/** Daily board for `dayNumber`: the day's fixed seed and weekday tier, never the player's own history. */
export function dailyFromRobust<TLevel>(robust: RobustGenerator<TLevel>) {
  return (dayNumber: number): TLevel | Promise<TLevel> =>
    robust(dailySeedIndex(dayNumber), dailyRating(tierForDayNumber(dayNumber)), []);
}

/**
 * Derives a game's Daily Puzzle store config from its regular one. Same
 * level shape, same per-level `custom` board state and helpers -- so the
 * game's own progress hook (rect placing, tube pouring...) works on it
 * unchanged -- but keyed by day number instead of level index, with:
 *  - generation from the day alone (see `dailyFromRobust`),
 *  - a frozen skill rating, so dailies never move the player's adaptive
 *    difficulty or unlock tiers,
 *  - today's board, not level 0, prepared as soon as progress loads.
 * Boards are persisted once generated, so an update to a generator never
 * swaps a daily under a player mid-day.
 */
export function toDailyStoreConfig<TLevel, TCustom>(
  base: ProgressStoreConfig<TLevel, TCustom>,
  gameId: string,
  generateDaily: (dayNumber: number, custom: TCustom) => TLevel | Promise<TLevel>
): ProgressStoreConfig<TLevel, TCustom> {
  return {
    ...base,
    storageKey: `@signal-arcade/${gameId}/daily/v1`,
    nextSkillRating: (prev) => prev,
    extraSkillInputs: undefined,
    generate: (dayNumber, _skillRating, _recentFingerprints, custom) => generateDaily(dayNumber, custom),
    initialLevelIndex: todayDayNumber,
    initialEnsureOpts: undefined,
  };
}

/** Nests several providers into one, outermost first -- for a game mounting both its regular and daily stores. */
export function composeProviders(...providers: Array<React.ComponentType<{ children: React.ReactNode }>>) {
  return function ComposedProviders({ children }: { children: React.ReactNode }) {
    return providers.reduceRight<React.ReactNode>((acc, Provider) => React.createElement(Provider, null, acc), children) as React.ReactElement;
  };
}
