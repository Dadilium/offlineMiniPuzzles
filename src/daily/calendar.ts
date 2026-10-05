// Pure calendar math for the Daily Puzzle -- no React/storage imports, so it
// can be checked in isolation (src/daily/__scripts__/daily.check.ts).
//
// Every date here is a local `YYYY-MM-DD` key (the player's own midnight,
// same as the daily hint gift). Arithmetic runs on `Date.UTC` of those
// components, so DST transitions never shift a day.
import { TIER_BANDS, type DifficultyTier } from '../state/difficultyTiers';

/** Daily #1. Fixed forever -- changing it renumbers (and reseeds) every daily. */
export const DAILY_EPOCH_KEY = '2026-10-01';

/** Offset added to the day number before it reaches a generator's
 * `seedFromLevelIndex`, so a daily board never shares a seed with a regular
 * level (those stay far below `maxGeneratedLevels`). */
const DAILY_SEED_INDEX_OFFSET = 1_000_000;

const MS_PER_DAY = 86_400_000;

/** Local calendar date of `d`. */
export function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function utcMsForKey(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** 1-indexed puzzle number for a day key (the "#142" on the share card). */
export function dayNumberForKey(key: string): number {
  return Math.round((utcMsForKey(key) - utcMsForKey(DAILY_EPOCH_KEY)) / MS_PER_DAY) + 1;
}

export function dayKeyForNumber(dayNumber: number): string {
  const d = new Date(utcMsForKey(DAILY_EPOCH_KEY) + (dayNumber - 1) * MS_PER_DAY);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Calendar month (1-12) and day of month for a puzzle number -- for the "Oct 5" label. */
export function monthDayForNumber(dayNumber: number): { month: number; day: number } {
  const [, m, d] = dayKeyForNumber(dayNumber).split('-').map(Number);
  return { month: m, day: d };
}

export function todayDayNumber(now: Date = new Date()): number {
  return dayNumberForKey(localDayKey(now));
}

/** Indexed by `Date#getUTCDay()` (0 = Sunday): easy early in the week,
 * ramping to an Expert Sunday -- the same for every player. */
const TIER_BY_WEEKDAY: readonly DifficultyTier[] = ['expert', 'easy', 'easy', 'medium', 'medium', 'hard', 'hard'];

export function tierForDayNumber(dayNumber: number): DifficultyTier {
  return TIER_BY_WEEKDAY[new Date(utcMsForKey(dayKeyForNumber(dayNumber))).getUTCDay()];
}

/** Fixed skill rating handed to a game's generator for a daily: the middle
 * of the tier's band, so every daily sits squarely inside its tier. */
export function dailyRating(tier: DifficultyTier): number {
  const [min, max] = TIER_BANDS[tier];
  return Math.round((min + max) / 2);
}

/** Level index fed to a game's existing seeded generator for this day. */
export function dailySeedIndex(dayNumber: number): number {
  return DAILY_SEED_INDEX_OFFSET + dayNumber;
}

/** Milliseconds until the next local midnight -- for rolling the day over while the app stays open. */
export function msUntilNextLocalMidnight(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return Math.max(1000, next.getTime() - now.getTime());
}
