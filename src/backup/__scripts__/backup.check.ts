/**
 * Assertion checks for progress backup: which keys travel, file validation,
 * the summary, and the "never trade newer progress for older" merge.
 * Rerun whenever backupFormat.ts or backupMerge.ts changes.
 *
 * Run with: npx tsx src/backup/__scripts__/backup.check.ts
 */
import { buildBackup, isBackupKey, isDailyBoardKey, isProgressKey, parseBackup, summarizeBackup } from '../backupFormat';
import { mergeBackup, mergeDailyResults, pickWallet } from '../backupMerge';

function check(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const progress = (completed: number[], skipped: number[] = []) => JSON.stringify({ levelsCompleted: completed, levelsSkipped: skipped, generatedLevels: {} });
const wallet = (balance: number, lastClaimDate: string | null, streakDays: number) => JSON.stringify({ balance, lastClaimDate, streakDays });

// --- key scope -------------------------------------------------------------
check(isBackupKey('@signal-arcade/kings/progress/v3'), 'game progress is backed up');
check(isBackupKey('@signal-arcade/settings/theme-mode/v1'), 'settings are backed up');
check(!isBackupKey('@signal-arcade/ads/interstitial-owed'), 'ad pacing stays on device');
check(!isBackupKey('@signal-arcade/review/v1'), 'rating-ask history stays on device');
check(!isBackupKey('@signal-arcade/reminders/v1'), 'reminder opt-in stays on device');
check(!isBackupKey('posthog.distinctId'), 'third-party keys are never backed up');
check(isProgressKey('@signal-arcade/tents-and-trees/progress/v3'), 'progress key pattern');
check(isDailyBoardKey('@signal-arcade/kings/daily/v1'), 'daily board key pattern');
check(!isDailyBoardKey('@signal-arcade/daily/results/v1'), 'daily results is not a board key');

// --- build + parse round trip ----------------------------------------------
const now = new Date('2026-10-06T12:00:00Z');
const built = buildBackup(
  [
    ['@signal-arcade/kings/progress/v3', progress([0, 1, 2])],
    ['@signal-arcade/ads/interstitial-owed', '{}'],
    ['@signal-arcade/settings/language/v1', 'fr'],
    ['@signal-arcade/shikaku/progress/v2', null],
  ],
  '1.2.0',
  now
);
check(Object.keys(built.entries).length === 2, 'build keeps only non-null backup keys');

const parsed = parseBackup(JSON.stringify(built));
check(parsed.ok && parsed.backup.entries['@signal-arcade/settings/language/v1'] === 'fr', 'round trip');

check(!parseBackup('not json').ok, 'rejects non-JSON');
const notBackup = parseBackup('{"hello":1}');
check(!notBackup.ok && notBackup.reason === 'not-a-backup', 'rejects foreign JSON');
const newer = parseBackup(JSON.stringify({ ...built, version: 99 }));
check(!newer.ok && newer.reason === 'newer-version', 'rejects a newer format');
const injected = parseBackup(JSON.stringify({ ...built, entries: { 'other-app/key': 'x', '@signal-arcade/kings/progress/v3': 42 } }));
check(injected.ok && Object.keys(injected.backup.entries).length === 0, 'drops foreign keys and non-string values');

// --- summary ---------------------------------------------------------------
const summary = summarizeBackup({
  ...built,
  entries: {
    '@signal-arcade/kings/progress/v3': progress([0, 1, 2]),
    '@signal-arcade/arrows/progress/v2': progress([0], [1]),
    '@signal-arcade/daily/results/v1': JSON.stringify({
      byGame: { kings: { 5: { elapsedMs: 1, hintsUsed: 0, solved: true }, 6: { elapsedMs: 1, hintsUsed: 0, solved: false } } },
    }),
  },
});
check(summary.levelsCompleted === 4 && summary.dailiesSolved === 1, 'summary counts levels and solved dailies');

// --- merge: progress -------------------------------------------------------
const K = '@signal-arcade/kings/progress/v3';
check(mergeBackup({}, { [K]: progress([0]) })[K] === progress([0]), 'fresh device takes the backup');
check(mergeBackup({ [K]: progress([0]) }, { [K]: progress([0, 1]) })[K] === progress([0, 1]), 'backup further ahead wins');
check(!(K in mergeBackup({ [K]: progress([0, 1, 2]) }, { [K]: progress([0]) })), 'device further ahead is kept');
check(!(K in mergeBackup({ [K]: progress([0, 1]) }, { [K]: progress([0], [1]) })), 'tie keeps the device');
check(Object.keys(mergeBackup({ [K]: progress([0]) }, { [K]: progress([0]) })).length === 0, 'identical data writes nothing');

// --- merge: settings -------------------------------------------------------
const LANG = '@signal-arcade/settings/language/v1';
check(mergeBackup({}, { [LANG]: 'fr' })[LANG] === 'fr', 'missing setting is restored');
check(!(LANG in mergeBackup({ [LANG]: 'en' }, { [LANG]: 'fr' })), 'existing setting is kept');

// --- merge: daily results --------------------------------------------------
const merged = mergeDailyResults(
  { byGame: { kings: { 1: { elapsedMs: 50, hintsUsed: 0, solved: true }, 2: { elapsedMs: 10, hintsUsed: 1, solved: false } } } },
  {
    byGame: {
      kings: { 1: { elapsedMs: 99, hintsUsed: 3, solved: false }, 2: { elapsedMs: 30, hintsUsed: 0, solved: false }, 3: { elapsedMs: 5, hintsUsed: 0, solved: true } },
      arrows: { 1: { elapsedMs: 7, hintsUsed: 0, solved: true } },
    },
  }
);
check(merged.byGame.kings[1].solved && merged.byGame.kings[1].elapsedMs === 50, 'solved day beats unsolved');
check(merged.byGame.kings[2].elapsedMs === 30 && merged.byGame.kings[2].hintsUsed === 1, 'unsolved days keep max time and hints');
check(merged.byGame.kings[3]?.solved === true && merged.byGame.arrows[1]?.solved === true, 'days from both sides survive');

// --- merge: hint wallet ----------------------------------------------------
const parseWallet = (raw: string) => JSON.parse(raw);
check(pickWallet(parseWallet(wallet(2, '2026-10-06', 0)), parseWallet(wallet(9, '2026-10-01', 4))), 'fresh install takes backup wallet');
check(!pickWallet(parseWallet(wallet(1, '2026-10-05', 3)), parseWallet(wallet(9, '2026-10-05', 3))), 'same-day older backup cannot refill spent hints');
check(pickWallet(parseWallet(wallet(1, '2026-10-01', 2)), parseWallet(wallet(4, '2026-10-05', 6))), 'more recent backup wallet wins');
check(!pickWallet(parseWallet(wallet(5, '2026-10-05', 6)), parseWallet(wallet(9, '2026-10-01', 2))), 'older backup wallet loses');

console.log('backup: all checks passed');
