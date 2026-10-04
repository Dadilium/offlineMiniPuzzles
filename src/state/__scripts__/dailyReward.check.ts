/**
 * Assertion checks for the daily hint gift: starting balance, the streak
 * reward table, streak resets, and calendar edge cases (month/year
 * boundaries, DST). Rerun whenever the reward table or claim rules change.
 *
 * Run with: npx tsx src/state/__scripts__/dailyReward.check.ts
 * DST cases only bite in a zone that observes DST, so also run e.g.:
 *   TZ=America/New_York npx tsx src/state/__scripts__/dailyReward.check.ts
 *   TZ=Europe/Paris npx tsx src/state/__scripts__/dailyReward.check.ts
 */
import {
  DAILY_REWARD_BY_STREAK_DAY,
  STARTING_BALANCE,
  dateKey,
  daysBetween,
  defaultState,
  resolveLaunchClaim,
  type PersistedShape,
} from '../dailyReward';

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

/** YYYY-MM-DD `n` local calendar days after `key`. */
function addDays(key: string, n: number): string {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

/** Launches once per listed day (in order) and returns each launch's reward (0 = no claim) plus the final state. */
function simulate(start: PersistedShape, days: string[]): { rewards: number[]; state: PersistedShape } {
  return days.reduce(
    (acc, day) => {
      const { state, claim } = resolveLaunchClaim(acc.state, day, false);
      return { rewards: [...acc.rewards, claim?.reward ?? 0], state };
    },
    { rewards: [] as number[], state: start }
  );
}

const consecutiveDays = (from: string, count: number): string[] => Array.from({ length: count }, (_, i) => addDays(from, i));
const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

const checks: Array<[string, () => void]> = [
  [
    'first-ever launch grants nothing and keeps the starting balance',
    () => {
      const { state, claim } = resolveLaunchClaim(defaultState(), '2026-10-04', false);
      assert.equal(claim, null);
      assert.equal(state.balance, STARTING_BALANCE);
      assert.equal(state.streakDays, 0);
    },
  ],
  [
    'relaunching the same day never claims twice',
    () => {
      const { rewards, state } = simulate(defaultState(), ['2026-10-04', '2026-10-05', '2026-10-05', '2026-10-05']);
      assert.deepEqual(rewards, [0, 1, 0, 0]);
      assert.equal(state.balance, STARTING_BALANCE + 1);
    },
  ],
  [
    'consecutive days follow the reward table, then cycle',
    () => {
      const days = consecutiveDays('2026-10-04', 1 + DAILY_REWARD_BY_STREAK_DAY.length * 2);
      const { rewards, state } = simulate(defaultState(), days);
      const expected = [0, ...DAILY_REWARD_BY_STREAK_DAY, ...DAILY_REWARD_BY_STREAK_DAY];
      assert.deepEqual(rewards, expected);
      assert.equal(state.balance, STARTING_BALANCE + sum(expected));
      assert.equal(state.streakDays, DAILY_REWARD_BY_STREAK_DAY.length * 2);
    },
  ],
  [
    'missing a day restarts the streak at day 1',
    () => {
      const { rewards } = simulate(defaultState(), ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-09', '2026-10-10']);
      assert.deepEqual(rewards, [0, 1, 1, 2, 1, 1]);
    },
  ],
  [
    'month and year boundaries count as consecutive',
    () => {
      assert.deepEqual(simulate(defaultState(), ['2026-01-30', '2026-01-31', '2026-02-01', '2026-02-02']).rewards, [0, 1, 1, 2]);
      assert.deepEqual(simulate(defaultState(), ['2026-12-30', '2026-12-31', '2027-01-01']).rewards, [0, 1, 1]);
      assert.deepEqual(simulate(defaultState(), ['2028-02-28', '2028-02-29', '2028-03-01']).rewards, [0, 1, 1]);
    },
  ],
  [
    'DST transitions are exactly one day apart',
    () => {
      // US (Mar 8 / Nov 1 2026) and EU (Mar 29 / Oct 25 2026) switches.
      for (const day of ['2026-03-08', '2026-11-01', '2026-03-29', '2026-10-25']) {
        assert.equal(daysBetween(addDays(day, -1), day), 1, `before -> ${day}`);
        assert.equal(daysBetween(day, addDays(day, 1)), 1, `${day} -> after`);
      }
    },
  ],
  [
    'moving the device clock backwards grants nothing',
    () => {
      const claimed: PersistedShape = { balance: 10, lastClaimDate: '2026-10-04', streakDays: 3 };
      const { rewards, state } = simulate(claimed, ['2026-10-03', '2026-10-01']);
      assert.deepEqual(rewards, [0, 0]);
      assert.deepEqual(state, claimed, 'state untouched');
    },
  ],
  [
    'clock rolled back then restored only claims the real day once',
    () => {
      const claimed: PersistedShape = { balance: 10, lastClaimDate: '2026-10-04', streakDays: 3 };
      const { rewards } = simulate(claimed, ['2026-10-01', '2026-10-04', '2026-10-05']);
      assert.deepEqual(rewards, [0, 0, DAILY_REWARD_BY_STREAK_DAY[3]]);
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
if (failed > 0) throw new Error(`${failed} daily reward check(s) failed`);
