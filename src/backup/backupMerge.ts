import { sanitizeResults, type DailyEntry, type DailyResultsState } from '../daily/dailyResults';
import { sanitizePersisted as sanitizeWallet, type PersistedShape as WalletState } from '../state/dailyReward';
import { DAILY_RESULTS_KEY, HINT_WALLET_KEY, isDailyBoardKey, isProgressKey, progressScore, safeParseJson } from './backupFormat';

/**
 * Pure restore rule: folds a backup into what's already on this device,
 * never trading newer progress for older. Per key:
 * - Game progress / daily boards: whichever side has more levels done wins
 *   as a whole (boards, tiers and rating stay consistent with each other).
 *   A tie keeps this device's copy.
 * - Daily results: merged day by day, so streaks from both sides survive. A
 *   solved day beats an unsolved one; two unsolved days keep the larger
 *   time/hint counts.
 * - Hint wallet: the backup wins only if this device never claimed a daily
 *   gift yet (a fresh install), or the backup's last claim is more recent --
 *   so restoring an older file can't refill hints that were since spent.
 * - Anything else (settings...): restored only where this device has none.
 *
 * Returns only the keys that actually change.
 */
export function mergeBackup(local: Readonly<Record<string, string | null>>, backup: Readonly<Record<string, string>>): Record<string, string> {
  const writes: Record<string, string> = {};
  for (const [key, incoming] of Object.entries(backup)) {
    const current = local[key] ?? null;
    const merged = mergeEntry(key, current, incoming);
    if (merged !== null && merged !== current) writes[key] = merged;
  }
  return writes;
}

function mergeEntry(key: string, current: string | null, incoming: string): string | null {
  if (current === null) return incoming;
  if (isProgressKey(key) || isDailyBoardKey(key)) {
    return progressScore(safeParseJson(incoming)) > progressScore(safeParseJson(current)) ? incoming : current;
  }
  if (key === DAILY_RESULTS_KEY) {
    return JSON.stringify(mergeDailyResults(sanitizeResults(safeParseJson(current)), sanitizeResults(safeParseJson(incoming))));
  }
  if (key === HINT_WALLET_KEY) {
    return pickWallet(sanitizeWallet(safeParseJson(current) as Partial<WalletState> | null), sanitizeWallet(safeParseJson(incoming) as Partial<WalletState> | null))
      ? incoming
      : current;
  }
  return current;
}

export function mergeDailyResults(local: DailyResultsState, incoming: DailyResultsState): DailyResultsState {
  const byGame: DailyResultsState['byGame'] = { ...local.byGame };
  for (const [gameId, days] of Object.entries(incoming.byGame)) {
    const mergedDays: Record<number, DailyEntry> = { ...byGame[gameId] };
    for (const [day, entry] of Object.entries(days)) {
      const existing = mergedDays[Number(day)];
      mergedDays[Number(day)] = existing ? mergeDailyEntry(existing, entry) : entry;
    }
    byGame[gameId] = mergedDays;
  }
  return { byGame };
}

function mergeDailyEntry(local: DailyEntry, incoming: DailyEntry): DailyEntry {
  if (local.solved !== incoming.solved) return local.solved ? local : incoming;
  if (local.solved) return local;
  return {
    elapsedMs: Math.max(local.elapsedMs, incoming.elapsedMs),
    hintsUsed: Math.max(local.hintsUsed, incoming.hintsUsed),
    solved: false,
  };
}

/** True when the backup's wallet should replace this device's. */
export function pickWallet(local: WalletState, incoming: WalletState): boolean {
  if (local.streakDays === 0) return incoming.streakDays > 0 || incoming.balance > local.balance;
  if (!incoming.lastClaimDate) return false;
  return !local.lastClaimDate || incoming.lastClaimDate > local.lastClaimDate;
}
