import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState, Share } from 'react-native';
import { useTranslation } from 'react-i18next';
import { posthog } from '../config/posthog';
import { emitLevelCompleted } from '../state/levelEvents';
import { translateDynamic } from '../i18n/dynamicKey';
import { tierForDayNumber } from './calendar';
import { formatDailyDate } from './dailyDate';
import { useDailyResults } from './DailyResultsProvider';
import { formatDuration, formatShareLine } from './shareText';

interface Options {
  gameId: string;
  /** The daily's day number, or null when this screen is a regular level. */
  dayNumber: number | null;
  /** The board has loaded -- the clock only runs while there's something to play. */
  ready: boolean;
  won: boolean;
}

export interface DailySession {
  isDaily: boolean;
  /** "Daily #142 · Hard" -- undefined for a regular level. */
  title: string | undefined;
  /** Call on every hint actually given -- counted even if the board is later reset. */
  noteHint: () => void;
  /** Call once, from the win effect. Freezes the clock and records the solve (first solve only). */
  recordWin: () => void;
  /** Win-overlay copy for the daily, e.g. "Solved in 2:31 · 🔥 3 days". */
  winSubtitle: string;
  share: () => void;
}

/**
 * Everything a game screen needs to run in Daily Puzzle mode, so each game
 * only adds a few lines: the active-play clock (paused while backgrounded or
 * off-screen, persisted so leaving and coming back keeps counting from where
 * it was), hint tally, solve recording and the share sheet. A no-op shell
 * when `dayNumber` is null.
 */
export function useDailySession({ gameId, dayNumber, ready, won }: Options): DailySession {
  const { t } = useTranslation('common');
  const results = useDailyResults();
  const isDaily = dayNumber !== null;
  const entry = isDaily ? results.entryFor(gameId, dayNumber) : null;
  const alreadySolved = entry?.solved ?? false;
  const running = isDaily && ready && !won && !alreadySolved;

  const resultsRef = useRef(results);
  resultsRef.current = results;
  // Wall-clock start of the current unflushed play segment, or null while paused.
  const segmentStart = useRef<number | null>(null);

  const flush = useCallback(() => {
    if (dayNumber === null || segmentStart.current === null) return;
    const ms = Date.now() - segmentStart.current;
    segmentStart.current = null;
    resultsRef.current.addElapsed(gameId, dayNumber, ms);
  }, [gameId, dayNumber]);

  useEffect(() => {
    if (!running) return undefined;
    segmentStart.current = AppState.currentState === 'active' ? Date.now() : null;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        if (segmentStart.current === null) segmentStart.current = Date.now();
      } else {
        flush();
      }
    });
    return () => {
      sub.remove();
      flush();
    };
  }, [running, flush]);

  const startedFor = useRef<number | null>(null);
  useEffect(() => {
    if (!running || dayNumber === null || startedFor.current === dayNumber) return;
    startedFor.current = dayNumber;
    posthog?.capture('daily_started', { game_id: gameId, day_number: dayNumber, tier: tierForDayNumber(dayNumber) });
  }, [running, gameId, dayNumber]);

  const noteHint = useCallback(() => {
    if (dayNumber !== null) resultsRef.current.addHint(gameId, dayNumber);
  }, [gameId, dayNumber]);

  const recordWin = useCallback(() => {
    if (dayNumber === null) return;
    const current = resultsRef.current.entryFor(gameId, dayNumber);
    if (current.solved) return;
    const segment = segmentStart.current === null ? 0 : Date.now() - segmentStart.current;
    segmentStart.current = null;
    const elapsedMs = current.elapsedMs + segment;
    resultsRef.current.markSolved(gameId, dayNumber, elapsedMs);
    emitLevelCompleted({ tier: tierForDayNumber(dayNumber), hintsUsed: current.hintsUsed });
    posthog?.capture('daily_completed', {
      game_id: gameId,
      day_number: dayNumber,
      tier: tierForDayNumber(dayNumber),
      time_ms: elapsedMs,
      hints: current.hintsUsed,
    });
  }, [gameId, dayNumber]);

  const tierLabel = dayNumber === null ? '' : t(`difficulty.tiers.${tierForDayNumber(dayNumber)}`);
  const title = dayNumber === null ? undefined : t('daily.gameTitle', { date: formatDailyDate(t, dayNumber), tier: tierLabel });
  const streak = results.streakFor(gameId).current;
  const elapsedMs = entry?.elapsedMs ?? 0;
  const hintsUsed = entry?.hintsUsed ?? 0;

  const winSubtitle = useMemo(() => {
    const time = t('daily.solvedIn', { time: formatDuration(elapsedMs) });
    return streak > 1 ? `${time} · ${t('daily.streakDays', { count: streak })}` : time;
  }, [t, elapsedMs, streak]);

  const share = useCallback(() => {
    if (dayNumber === null) return;
    const line = formatShareLine({
      gameName: translateDynamic(t, `${gameId}:meta.name`),
      dayNumber,
      tierLabel,
      elapsedMs,
      hintsUsed,
      streak,
    });
    posthog?.capture('daily_shared', { game_id: gameId, day_number: dayNumber });
    Share.share({ message: `${line}\n${t('daily.shareFooter')}` }).catch(() => {});
  }, [t, gameId, dayNumber, tierLabel, elapsedMs, hintsUsed, streak]);

  return { isDaily, title, noteHint, recordWin, winSubtitle, share };
}
