/**
 * Assertion checks for the store-rating ask: which wins count, milestones,
 * daily-streak triggers, the install-age gate, cooldown and lifetime cap.
 * Rerun whenever reviewRules.ts changes.
 *
 * Run with: npx tsx src/review/__scripts__/reviewRules.check.ts
 */
import {
  applyReviewEvent,
  COOLDOWN_MS,
  defaultReviewState,
  MAX_PROMPTS,
  MIN_INSTALL_AGE_MS,
  sanitizeReviewState,
  shouldPresentReview,
  withFirstSeen,
  withPromptShown,
  type ReviewEvent,
  type ReviewState,
} from '../reviewRules';

// Local assert helpers rather than `node:assert` -- the app tsconfig has no
// Node types, and this script is type-checked along with the rest of src/.
const assert = {
  equal<T>(actual: T, expected: T, message?: string): void {
    if (actual !== expected) throw new Error(message ? `${message}: expected ${String(expected)}, got ${String(actual)}` : `expected ${String(expected)}, got ${String(actual)}`);
  },
  deepEqual(actual: unknown, expected: unknown, message?: string): void {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) throw new Error(message ? `${message}: expected ${e}, got ${a}` : `expected ${e}, got ${a}`);
  },
};

const DAY = 86_400_000;
const T0 = 1_800_000_000_000;
const cleanHard: ReviewEvent = { type: 'levelWin', tier: 'hard', hintsUsed: 0 };
const fresh = (): ReviewState => withFirstSeen(defaultReviewState(), T0);
const fold = (state: ReviewState, events: ReviewEvent[], now: number) => events.reduce((s, e) => applyReviewEvent(s, e, now), state);
const times = (event: ReviewEvent, n: number) => Array.from({ length: n }, () => event);

const checks: Array<[string, () => void]> = [
  [
    'only clean Hard/Expert wins count',
    () => {
      let s = fresh();
      s = applyReviewEvent(s, { type: 'levelWin', tier: 'easy', hintsUsed: 0 }, T0);
      s = applyReviewEvent(s, { type: 'levelWin', tier: 'medium', hintsUsed: 0 }, T0);
      s = applyReviewEvent(s, { type: 'levelWin', tier: 'hard', hintsUsed: 1 }, T0);
      assert.equal(s.cleanHardWins, 0);
      s = applyReviewEvent(s, { type: 'levelWin', tier: 'expert', hintsUsed: 0 }, T0);
      assert.equal(s.cleanHardWins, 1);
    },
  ],
  [
    'the 3rd clean Hard win makes the ask owed, not the 1st or 2nd',
    () => {
      const two = fold(fresh(), times(cleanHard, 2), T0);
      assert.equal(two.owed, false);
      assert.equal(applyReviewEvent(two, cleanHard, T0).owed, true);
    },
  ],
  [
    'not presented in the first two days, even when owed',
    () => {
      const s = fold(fresh(), times(cleanHard, 3), T0);
      assert.equal(shouldPresentReview(s, T0 + DAY), false);
      assert.equal(shouldPresentReview(s, T0 + MIN_INSTALL_AGE_MS), true);
    },
  ],
  [
    'once shown: no longer owed, and a milestone during the cooldown is dropped',
    () => {
      const now = T0 + 3 * DAY;
      let s = withPromptShown(fold(fresh(), times(cleanHard, 3), now), now);
      assert.equal(s.owed, false);
      s = fold(s, times(cleanHard, 12), now + 10 * DAY); // 15th clean win -- milestone mid-cooldown
      assert.equal(s.cleanHardWins, 15);
      assert.equal(s.owed, false);
    },
  ],
  [
    'after the cooldown, the next milestone is owed again',
    () => {
      const now = T0 + 3 * DAY;
      let s = withPromptShown(fold(fresh(), times(cleanHard, 3), now), now);
      s = fold(s, times(cleanHard, 12), now + COOLDOWN_MS + DAY);
      assert.equal(s.owed, true);
      assert.equal(shouldPresentReview(s, now + COOLDOWN_MS + DAY), true);
    },
  ],
  [
    'lifetime cap: never owed or presented past MAX_PROMPTS',
    () => {
      let s: ReviewState = { ...fresh(), promptCount: MAX_PROMPTS, lastPromptAt: T0 - 400 * DAY };
      s = applyReviewEvent(s, { type: 'dailyStreak', streak: 30 }, T0 + 3 * DAY);
      assert.equal(s.owed, false);
      assert.equal(shouldPresentReview({ ...s, owed: true }, T0 + 3 * DAY), false);
    },
  ],
  [
    'daily streak: 7 days triggers once, repeats of the same streak do not',
    () => {
      let s = applyReviewEvent(fresh(), { type: 'dailyStreak', streak: 6 }, T0);
      assert.equal(s.owed, false);
      s = applyReviewEvent(s, { type: 'dailyStreak', streak: 7 }, T0);
      assert.equal(s.owed, true);
      assert.equal(s.bestStreakMilestone, 7);
      const shown = withPromptShown(s, T0 + 3 * DAY);
      const again = applyReviewEvent(shown, { type: 'dailyStreak', streak: 7 }, T0 + 200 * DAY);
      assert.equal(again, shown);
    },
  ],
  [
    'daily streak: jumping past several milestones counts the highest once',
    () => {
      const s = applyReviewEvent(fresh(), { type: 'dailyStreak', streak: 45 }, T0);
      assert.equal(s.bestStreakMilestone, 30);
      assert.equal(s.owed, true);
    },
  ],
  [
    'non-qualifying events return the same object (no needless writes)',
    () => {
      const s = fresh();
      assert.equal(applyReviewEvent(s, { type: 'levelWin', tier: 'easy', hintsUsed: 0 }, T0), s);
      assert.equal(applyReviewEvent(s, { type: 'dailyStreak', streak: 3 }, T0), s);
    },
  ],
  [
    'first-seen is stamped once',
    () => {
      const s = withFirstSeen(defaultReviewState(), T0);
      assert.equal(withFirstSeen(s, T0 + DAY), s);
    },
  ],
  [
    'sanitize: corrupt fields fall back, valid ones are kept',
    () => {
      assert.deepEqual(sanitizeReviewState(null), defaultReviewState());
      assert.deepEqual(sanitizeReviewState({ cleanHardWins: 'x', owed: 1, promptCount: 2, firstSeenAt: T0 }), {
        ...defaultReviewState(),
        firstSeenAt: T0,
        promptCount: 2,
      });
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
if (failed > 0) throw new Error(`${failed} review rule check(s) failed`);
