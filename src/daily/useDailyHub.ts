import { useEffect, useRef } from 'react';
import { tierForDayNumber } from './calendar';
import { useDailyResults } from './DailyResultsProvider';
import type { DailyHubCardProps } from './DailyHubCard';
import type { DailyOrigin } from './navigation';
import { useDailySession } from './useDailySession';

interface Options {
  gameId: string;
  /** The game's *daily* store `ensureLevel` -- builds today's board ahead of the tap. */
  ensureDailyLevel: (dayNumber: number) => void;
  /** Opens today's daily (through the tutorial first, if the player hasn't seen it). `origin` is where Done/back return to. */
  enterDaily: (dayNumber: number, origin: DailyOrigin) => void;
  /** The hub's `startDaily` route param -- set by the Library's Today strip. */
  startDailyParam: boolean | undefined;
  clearStartDailyParam: () => void;
}

/** Wires a game hub's Daily card: today's state, building the board ahead of the tap (rollover-aware), and the Today-strip auto-start. */
export function useDailyHub({ gameId, ensureDailyLevel, enterDaily, startDailyParam, clearStartDailyParam }: Options): DailyHubCardProps {
  const results = useDailyResults();
  const today = results.today;
  const entry = results.entryFor(gameId, today);
  const { share } = useDailySession({ gameId, dayNumber: today, ready: false, won: false });

  // Re-runs on day rollover too, so a hub left open past midnight still has the new board ready.
  useEffect(() => {
    ensureDailyLevel(today);
  }, [today, ensureDailyLevel]);

  // Callers pass fresh closures every render -- kept in a ref so the
  // auto-start effect below only re-runs when the param itself changes.
  const latest = useRef({ enterDaily, clearStartDailyParam, solved: entry.solved, today });
  latest.current = { enterDaily, clearStartDailyParam, solved: entry.solved, today };
  useEffect(() => {
    if (!startDailyParam || !results.ready) return;
    const { enterDaily: enter, clearStartDailyParam: clear, solved, today: day } = latest.current;
    clear();
    // Already solved: stay on the hub, where the card shows the result + Share.
    if (!solved) enter(day, 'library');
  }, [startDailyParam, results.ready]);

  return {
    dayNumber: today,
    tier: tierForDayNumber(today),
    streak: results.streakFor(gameId).current,
    status: entry.solved ? 'solved' : entry.elapsedMs > 0 || entry.hintsUsed > 0 ? 'started' : 'new',
    elapsedMs: entry.elapsedMs,
    onPlay: () => enterDaily(today, 'hub'),
    onShare: share,
  };
}
