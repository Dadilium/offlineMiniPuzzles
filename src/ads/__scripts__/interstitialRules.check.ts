/**
 * Assertion checks for the interstitial cadence: the per-game schedule, the
 * owed-ad record (decided at the win, shown at the next level start), and
 * the app-wide cooldown. Rerun whenever the schedule or owed/cooldown rules
 * change.
 *
 * Run with: npx tsx src/ads/__scripts__/interstitialRules.check.ts
 */
import {
  DEFAULT_INTERSTITIAL_STATE,
  INTERSTITIAL_COOLDOWN_MS,
  isInterstitialCoolingDown,
  nextInterstitialDecision,
  SETTLED_INTERSTITIAL_STATE,
  withOwedTrigger,
  withoutWatched,
  type InterstitialSchedule,
  type InterstitialState,
  type OwedInterstitial,
} from '../interstitialRules';

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

const DEFAULT_SCHEDULE: InterstitialSchedule = { first: 5, interval: 3 };
const CTX = { game_id: 'shikaku', trigger: 'level_complete' };

/**
 * Plays `wins` first clears in one game, where every due ad is owed and then
 * watched at the next level start -- mirrors InterstitialProvider's
 * recordTrigger -> presentOwed -> close flow using only the pure rules.
 * Returns the 1-indexed wins after which an ad was owed.
 */
function adsOwedAcrossWins(wins: number, schedule: InterstitialSchedule): number[] {
  let state: InterstitialState = DEFAULT_INTERSTITIAL_STATE;
  const owedAfter: number[] = [];
  for (let win = 1; win <= wins; win++) {
    const { due, sinceLastAd } = nextInterstitialDecision(state, schedule);
    if (!due) {
      state = { ...state, sinceLastAd };
      continue;
    }
    owedAfter.push(win);
    state = SETTLED_INTERSTITIAL_STATE; // watched at the next level start
  }
  return owedAfter;
}

const checks: Array<[string, () => void]> = [
  [
    'default schedule: first ad after win 5, then every 3rd win',
    () => {
      assert.deepEqual(adsOwedAcrossWins(14, DEFAULT_SCHEDULE), [5, 8, 11, 14]);
    },
  ],
  [
    'Matching Numbers / Find Words style schedules',
    () => {
      assert.deepEqual(adsOwedAcrossWins(8, { first: 2, interval: 2 }), [2, 4, 6, 8]);
      assert.deepEqual(adsOwedAcrossWins(9, { first: 3, interval: 2 }), [3, 5, 7, 9]);
    },
  ],
  [
    'an owed ad not yet watched keeps the cadence due on the next win',
    () => {
      const owedState: InterstitialState = { sinceLastAd: 5, everShownAd: false, pendingRetry: true };
      assert.equal(nextInterstitialDecision(owedState, DEFAULT_SCHEDULE).due, true);
    },
  ],
  [
    'forceDue makes an ad due regardless of the count',
    () => {
      assert.equal(nextInterstitialDecision(DEFAULT_INTERSTITIAL_STATE, DEFAULT_SCHEDULE, true).due, true);
    },
  ],
  [
    'owed record merges triggers from several games without duplicates',
    () => {
      let owed: OwedInterstitial | null = null;
      owed = withOwedTrigger(owed, 'kings', { game_id: 'kings', trigger: 'level_complete' });
      owed = withOwedTrigger(owed, 'shikaku', CTX);
      owed = withOwedTrigger(owed, 'kings', { game_id: 'kings', trigger: 'level_complete' });
      assert.deepEqual(owed.storageKeys, ['kings', 'shikaku']);
      assert.equal(owed.context.game_id, 'kings', 'context tracks the latest trigger');
    },
  ],
  [
    'watching the owed ad clears it, keeping only counters that came due meanwhile',
    () => {
      const watched = withOwedTrigger(null, 'kings', CTX);
      assert.equal(withoutWatched(watched, watched), null);
      const meanwhile = withOwedTrigger(watched, 'shikaku', CTX);
      assert.deepEqual(withoutWatched(meanwhile, watched)?.storageKeys, ['shikaku']);
      assert.equal(withoutWatched(null, watched), null);
    },
  ],
  [
    'cooldown blocks for exactly INTERSTITIAL_COOLDOWN_MS after a show',
    () => {
      const shownAt = 1_000_000;
      assert.equal(isInterstitialCoolingDown(null, shownAt), false, 'never shown');
      assert.equal(isInterstitialCoolingDown(shownAt, shownAt), true);
      assert.equal(isInterstitialCoolingDown(shownAt, shownAt + INTERSTITIAL_COOLDOWN_MS - 1), true);
      assert.equal(isInterstitialCoolingDown(shownAt, shownAt + INTERSTITIAL_COOLDOWN_MS), false);
    },
  ],
  [
    'a clock moved backwards never blocks ads indefinitely',
    () => {
      assert.equal(isInterstitialCoolingDown(2_000_000, 1_000_000), false);
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
if (failed > 0) throw new Error(`${failed} interstitial check(s) failed`);
