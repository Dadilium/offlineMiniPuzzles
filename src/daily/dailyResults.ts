// Pure state transitions for the cross-game daily results ledger -- the one
// source of truth for "solved / time / hints" per (game, day), which streaks,
// the Library's Today strip and the share card all read. Boards themselves
// live in each game's own daily progress store, not here.

export interface DailyEntry {
  /** Active play time so far (screen open, app foregrounded). Frozen once solved. */
  elapsedMs: number;
  /** Hints spent on this daily -- only ever grows, so resetting the board can't hide them. */
  hintsUsed: number;
  solved: boolean;
}

export interface DailyResultsState {
  byGame: Record<string, Record<number, DailyEntry>>;
}

export function defaultResults(): DailyResultsState {
  return { byGame: {} };
}

const EMPTY_ENTRY: DailyEntry = { elapsedMs: 0, hintsUsed: 0, solved: false };

function isEntry(value: unknown): value is DailyEntry {
  const e = value as DailyEntry | null;
  return (
    !!e &&
    typeof e.elapsedMs === 'number' &&
    Number.isFinite(e.elapsedMs) &&
    typeof e.hintsUsed === 'number' &&
    Number.isFinite(e.hintsUsed) &&
    typeof e.solved === 'boolean'
  );
}

export function sanitizeResults(raw: unknown): DailyResultsState {
  const byGameRaw = (raw as Partial<DailyResultsState> | null)?.byGame;
  if (!byGameRaw || typeof byGameRaw !== 'object') return defaultResults();
  const byGame: DailyResultsState['byGame'] = {};
  for (const [gameId, days] of Object.entries(byGameRaw)) {
    if (!days || typeof days !== 'object') continue;
    const clean: Record<number, DailyEntry> = {};
    for (const [day, entry] of Object.entries(days as Record<string, unknown>)) {
      if (Number.isInteger(Number(day)) && isEntry(entry)) clean[Number(day)] = entry;
    }
    byGame[gameId] = clean;
  }
  return { byGame };
}

export function entryFor(state: DailyResultsState, gameId: string, day: number): DailyEntry {
  return state.byGame[gameId]?.[day] ?? EMPTY_ENTRY;
}

function withEntry(state: DailyResultsState, gameId: string, day: number, entry: DailyEntry): DailyResultsState {
  return { byGame: { ...state.byGame, [gameId]: { ...state.byGame[gameId], [day]: entry } } };
}

/** Adds play time to an unsolved daily. No-op once solved. */
export function addElapsed(state: DailyResultsState, gameId: string, day: number, ms: number): DailyResultsState {
  const entry = entryFor(state, gameId, day);
  if (entry.solved || ms <= 0) return state;
  return withEntry(state, gameId, day, { ...entry, elapsedMs: entry.elapsedMs + ms });
}

export function addHint(state: DailyResultsState, gameId: string, day: number): DailyResultsState {
  const entry = entryFor(state, gameId, day);
  if (entry.solved) return state;
  return withEntry(state, gameId, day, { ...entry, hintsUsed: entry.hintsUsed + 1 });
}

/** First solve wins -- replaying a solved daily never overwrites its result. */
export function markSolved(state: DailyResultsState, gameId: string, day: number, finalElapsedMs: number): DailyResultsState {
  const entry = entryFor(state, gameId, day);
  if (entry.solved) return state;
  return withEntry(state, gameId, day, { ...entry, elapsedMs: Math.max(entry.elapsedMs, finalElapsedMs), solved: true });
}

export function solvedDays(state: DailyResultsState, gameId: string): number[] {
  return Object.entries(state.byGame[gameId] ?? {})
    .filter(([, entry]) => entry.solved)
    .map(([day]) => Number(day));
}

export function allSolvedDays(state: DailyResultsState): number[][] {
  return Object.keys(state.byGame).map((gameId) => solvedDays(state, gameId));
}
