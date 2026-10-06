/**
 * Pure backup-file format: which storage keys travel in a backup, how the
 * file is built and validated, and the summary shown before restoring. No
 * storage or native imports, so it is checked by
 * `__scripts__/backup.check.ts`.
 */

export const BACKUP_FORMAT = 'puzzle-den-backup';
export const BACKUP_VERSION = 1;

const APP_KEY_PREFIX = '@signal-arcade/';

/**
 * Device-local state that must NOT follow the player to another device:
 * ad pacing, the store-rating ask history and reminder opt-in (tied to this
 * device's OS notification permission).
 */
const DEVICE_LOCAL_PREFIXES = ['@signal-arcade/ads/', '@signal-arcade/review/', '@signal-arcade/reminders/'];

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  /** ISO timestamp of when the backup was saved. */
  createdAt: string;
  appVersion: string;
  /** Raw AsyncStorage values, keyed by storage key. */
  entries: Record<string, string>;
}

export interface BackupSummary {
  createdAt: Date;
  /** Regular (non-daily) levels completed, across every game. */
  levelsCompleted: number;
  dailiesSolved: number;
}

export function isBackupKey(key: string): boolean {
  return key.startsWith(APP_KEY_PREFIX) && !DEVICE_LOCAL_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export function buildBackup(storage: ReadonlyArray<readonly [string, string | null]>, appVersion: string, now: Date): BackupFile {
  const entries: Record<string, string> = {};
  for (const [key, value] of storage) {
    if (value !== null && isBackupKey(key)) entries[key] = value;
  }
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt: now.toISOString(), appVersion, entries };
}

export function backupFileName(now: Date): string {
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return `puzzle-den-backup-${day}.json`;
}

export type ParseResult = { ok: true; backup: BackupFile } | { ok: false; reason: 'not-json' | 'not-a-backup' | 'newer-version' };

export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'not-json' };
  }

  const candidate = raw as Partial<BackupFile> | null;
  if (!candidate || typeof candidate !== 'object' || candidate.format !== BACKUP_FORMAT) return { ok: false, reason: 'not-a-backup' };
  if (typeof candidate.version !== 'number') return { ok: false, reason: 'not-a-backup' };
  if (candidate.version > BACKUP_VERSION) return { ok: false, reason: 'newer-version' };
  if (typeof candidate.createdAt !== 'string' || Number.isNaN(Date.parse(candidate.createdAt))) return { ok: false, reason: 'not-a-backup' };
  if (!candidate.entries || typeof candidate.entries !== 'object') return { ok: false, reason: 'not-a-backup' };

  // Only ever restore our own keys as strings -- a hand-edited file can't
  // inject anything else into storage.
  const entries: Record<string, string> = {};
  for (const [key, value] of Object.entries(candidate.entries)) {
    if (typeof value === 'string' && isBackupKey(key)) entries[key] = value;
  }

  return {
    ok: true,
    backup: {
      format: BACKUP_FORMAT,
      version: candidate.version,
      createdAt: candidate.createdAt,
      appVersion: typeof candidate.appVersion === 'string' ? candidate.appVersion : 'unknown',
      entries,
    },
  };
}

export function safeParseJson(value: string | null | undefined): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/** Per-game progress stores (regular levels) -- `@signal-arcade/<game>/progress/vN`. */
export function isProgressKey(key: string): boolean {
  return /^@signal-arcade\/[^/]+\/progress\/v\d+$/.test(key);
}

/** Per-game daily puzzle boards -- `@signal-arcade/<game>/daily/vN`. */
export function isDailyBoardKey(key: string): boolean {
  return /^@signal-arcade\/(?!daily\/)[^/]+\/daily\/v\d+$/.test(key);
}

export const DAILY_RESULTS_KEY = '@signal-arcade/daily/results/v1';
export const HINT_WALLET_KEY = '@signal-arcade/hints/wallet/v1';

/** Levels a progress blob counts as done (completed or skipped) -- the "how far along" score. */
export function progressScore(parsed: unknown): number {
  const p = parsed as { levelsCompleted?: unknown; levelsSkipped?: unknown } | null;
  const completed = Array.isArray(p?.levelsCompleted) ? p.levelsCompleted.length : 0;
  const skipped = Array.isArray(p?.levelsSkipped) ? p.levelsSkipped.length : 0;
  return completed + skipped;
}

export function summarizeBackup(backup: BackupFile): BackupSummary {
  let levelsCompleted = 0;
  let dailiesSolved = 0;
  for (const [key, value] of Object.entries(backup.entries)) {
    if (isProgressKey(key)) {
      const p = safeParseJson(value) as { levelsCompleted?: unknown } | null;
      if (Array.isArray(p?.levelsCompleted)) levelsCompleted += p.levelsCompleted.length;
    } else if (key === DAILY_RESULTS_KEY) {
      const results = safeParseJson(value) as { byGame?: Record<string, Record<string, { solved?: unknown }>> } | null;
      for (const days of Object.values(results?.byGame ?? {})) {
        for (const entry of Object.values(days ?? {})) if (entry?.solved === true) dailiesSolved += 1;
      }
    }
  }
  return { createdAt: new Date(backup.createdAt), levelsCompleted, dailiesSolved };
}
