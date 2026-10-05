/**
 * Assertion checks for the Daily Puzzle's pure rules: day numbering and the
 * weekday tier ramp (including month/year/DST boundaries), streaks, the
 * results ledger, and the share line. Rerun whenever any of them change.
 *
 * Run with: npx tsx src/daily/__scripts__/daily.check.ts
 * Day math must be DST-proof, so also run e.g.:
 *   TZ=America/New_York npx tsx src/daily/__scripts__/daily.check.ts
 *   TZ=Europe/Paris npx tsx src/daily/__scripts__/daily.check.ts
 */
import {
  DAILY_EPOCH_KEY,
  dailyRating,
  dailySeedIndex,
  dayKeyForNumber,
  dayNumberForKey,
  localDayKey,
  monthDayForNumber,
  msUntilNextLocalMidnight,
  tierForDayNumber,
} from '../calendar';
import { addElapsed, addHint, defaultResults, entryFor, markSolved, sanitizeResults, solvedDays } from '../dailyResults';
import { formatDuration, formatShareLine } from '../shareText';
import { computeStreak, unionDays } from '../streaks';
import { TIER_BANDS, tierForRating } from '../../state/difficultyTiers';

// Local assert helpers rather than `node:assert` -- the app tsconfig has no
// Node types, and this script is type-checked along with the rest of src/.
const assert = {
  equal<T>(actual: T, expected: T, message?: string): void {
    if (actual !== expected) throw new Error(message ?? `expected ${String(expected)}, got ${String(actual)}`);
  },
  deepEqual(actual: unknown, expected: unknown, message?: string): void {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) throw new Error(message ? `${message}: expected ${e}, got ${a}` : `expected ${e}, got ${a}`);
  },
};

const checks: Array<[string, () => void]> = [
  [
    'epoch is daily #1 and numbering is contiguous',
    () => {
      assert.equal(dayNumberForKey(DAILY_EPOCH_KEY), 1);
      assert.equal(dayNumberForKey('2026-10-05'), 5);
      assert.equal(dayNumberForKey('2026-11-01'), 32);
    },
  ],
  [
    'day number <-> key round-trips across month, year and leap-day boundaries',
    () => {
      for (const key of ['2026-10-31', '2026-11-01', '2026-12-31', '2027-01-01', '2028-02-28', '2028-02-29', '2028-03-01']) {
        assert.equal(dayKeyForNumber(dayNumberForKey(key)), key, key);
      }
      for (let n = 1; n <= 2000; n++) assert.equal(dayNumberForKey(dayKeyForNumber(n)), n, `day ${n}`);
    },
  ],
  [
    'DST switch days are exactly one day apart (Europe + US 2026/2027)',
    () => {
      for (const [a, b] of [
        ['2026-10-24', '2026-10-25'],
        ['2026-10-25', '2026-10-26'],
        ['2026-11-01', '2026-11-02'],
        ['2027-03-14', '2027-03-15'],
        ['2027-03-28', '2027-03-29'],
      ]) {
        assert.equal(dayNumberForKey(b) - dayNumberForKey(a), 1, `${a} -> ${b}`);
      }
    },
  ],
  [
    'month/day label parts for a puzzle number',
    () => {
      assert.deepEqual(monthDayForNumber(dayNumberForKey('2026-10-05')), { month: 10, day: 5 });
      assert.deepEqual(monthDayForNumber(dayNumberForKey('2027-01-01')), { month: 1, day: 1 });
      assert.deepEqual(monthDayForNumber(dayNumberForKey('2028-02-29')), { month: 2, day: 29 });
    },
  ],
  [
    'local day key uses local calendar fields',
    () => {
      assert.equal(localDayKey(new Date(2026, 0, 9, 23, 59)), '2026-01-09');
      assert.equal(localDayKey(new Date(2026, 11, 31, 0, 0)), '2026-12-31');
    },
  ],
  [
    'weekday ramp: Mon/Tue easy, Wed/Thu medium, Fri/Sat hard, Sun expert',
    () => {
      // 2026-10-05 is a Monday.
      const week = Array.from({ length: 7 }, (_, i) => tierForDayNumber(dayNumberForKey('2026-10-05') + i));
      assert.deepEqual(week, ['easy', 'easy', 'medium', 'medium', 'hard', 'hard', 'expert']);
    },
  ],
  [
    'daily rating sits inside its own tier band',
    () => {
      for (const tier of ['easy', 'medium', 'hard', 'expert'] as const) {
        const rating = dailyRating(tier);
        assert.equal(tierForRating(rating), tier, tier);
        assert.equal(rating >= TIER_BANDS[tier][0] && rating <= TIER_BANDS[tier][1], true, tier);
      }
    },
  ],
  [
    'daily seed index never collides with a regular level index',
    () => {
      assert.equal(dailySeedIndex(1) > 5000, true);
      assert.equal(dailySeedIndex(2) - dailySeedIndex(1), 1);
    },
  ],
  [
    'next-midnight countdown is positive and at most a day',
    () => {
      const ms = msUntilNextLocalMidnight(new Date(2026, 9, 5, 23, 59, 30));
      assert.equal(ms, 30_000);
      const fromMidnight = msUntilNextLocalMidnight(new Date(2026, 9, 5, 0, 0, 0));
      assert.equal(fromMidnight > 0 && fromMidnight <= 25 * 3_600_000, true);
    },
  ],
  [
    'streak: empty history',
    () => assert.deepEqual(computeStreak([], 10), { current: 0, best: 0 }),
  ],
  [
    'streak: unbroken run ending today',
    () => assert.deepEqual(computeStreak([8, 9, 10], 10), { current: 3, best: 3 }),
  ],
  [
    'streak: run ending yesterday is still alive (today not solved yet)',
    () => assert.deepEqual(computeStreak([7, 8, 9], 10), { current: 3, best: 3 }),
  ],
  [
    'streak: a whole missed day breaks it, best is kept',
    () => assert.deepEqual(computeStreak([1, 2, 3, 4, 7, 8], 10), { current: 0, best: 4 }),
  ],
  [
    'streak: duplicates, unsorted input and future days are ignored',
    () => assert.deepEqual(computeStreak([10, 9, 9, 8, 11, 12], 10), { current: 3, best: 3 }),
  ],
  [
    'overall streak counts a day if any game solved it',
    () => {
      const union = unionDays([[8, 10], [9]]);
      assert.deepEqual(computeStreak(union, 10), { current: 3, best: 3 });
    },
  ],
  [
    'results: elapsed and hints accumulate until solved, then freeze',
    () => {
      let s = defaultResults();
      s = addElapsed(s, 'kings', 5, 1000);
      s = addHint(s, 'kings', 5);
      s = addElapsed(s, 'kings', 5, 500);
      s = markSolved(s, 'kings', 5, 1600);
      s = addElapsed(s, 'kings', 5, 9999);
      s = addHint(s, 'kings', 5);
      assert.deepEqual(entryFor(s, 'kings', 5), { elapsedMs: 1600, hintsUsed: 1, solved: true });
    },
  ],
  [
    'results: first solve wins, a replay never overwrites it',
    () => {
      let s = markSolved(defaultResults(), 'shikaku', 3, 42_000);
      const before = s;
      s = markSolved(s, 'shikaku', 3, 1000);
      assert.equal(s, before);
      assert.deepEqual(solvedDays(s, 'shikaku'), [3]);
    },
  ],
  [
    'results: no-op transitions return the same object (no needless writes)',
    () => {
      const s = defaultResults();
      assert.equal(addElapsed(s, 'kings', 1, 0), s);
    },
  ],
  [
    'results: sanitize drops corrupt entries and keeps valid ones',
    () => {
      const raw = {
        byGame: {
          kings: { 4: { elapsedMs: 10, hintsUsed: 0, solved: true }, x: { elapsedMs: 1, hintsUsed: 0, solved: true }, 5: { elapsedMs: 'nope' } },
          broken: null,
        },
      };
      assert.deepEqual(sanitizeResults(raw), { byGame: { kings: { 4: { elapsedMs: 10, hintsUsed: 0, solved: true } } } });
      assert.deepEqual(sanitizeResults(null), defaultResults());
      assert.deepEqual(sanitizeResults({ byGame: 'oops' }), defaultResults());
    },
  ],
  [
    'duration formatting',
    () => {
      assert.equal(formatDuration(0), '0:00');
      assert.equal(formatDuration(151_900), '2:31');
      assert.equal(formatDuration(3_725_000), '1:02:05');
      assert.equal(formatDuration(-5), '0:00');
    },
  ],
  [
    'share line omits zero hints and single-day streaks',
    () => {
      const base = { gameName: 'Kings', dayNumber: 142, tierLabel: 'Hard', elapsedMs: 151_000 };
      assert.equal(formatShareLine({ ...base, hintsUsed: 0, streak: 1 }), 'Kings #142 · Hard ✅ 2:31');
      assert.equal(formatShareLine({ ...base, hintsUsed: 2, streak: 7 }), 'Kings #142 · Hard ✅ 2:31 💡2 🔥7');
    },
  ],
];

let failed = 0;
for (const [name, run] of checks) {
  try {
    run();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`  FAIL ${name}\n       ${(err as Error).message}`);
  }
}
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
if (failed > 0) throw new Error(`${failed} daily check(s) failed`);
