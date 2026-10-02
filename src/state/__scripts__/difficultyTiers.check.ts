/**
 * Assertion checks for the difficulty-tier model and its progress-store
 * transitions -- kept here (rather than as a one-off) so it can be rerun
 * whenever tiers, bands, or the store's switching logic change.
 *
 * Run with: npx tsx src/state/__scripts__/difficultyTiers.check.ts
 */
import type { ProgressState } from '../createProgressStore';
import {
  clampToTier,
  effectiveRating,
  isTierUnlocked,
  nextTier,
  tierFloor,
  tierForRating,
  unplayedLevelIndices,
} from '../difficultyTiers';
import { isLevelTouched, resolvePersistedTiers, withRating, withTierSwitch } from '../progressTransitions';

type Level = { n: number };
type Custom = { boardsByLevel: Record<number, number[]> };

// Local assert helpers rather than `node:assert` -- the app tsconfig has no
// Node types, and this script is type-checked along with the rest of src/.
const assert = {
  ok(value: unknown, message = 'expected truthy'): void {
    if (!value) throw new Error(message);
  },
  equal<T>(actual: T, expected: T, message?: string): void {
    if (actual !== expected) throw new Error(message ?? `expected ${String(expected)}, got ${String(actual)}`);
  },
  deepEqual(actual: unknown, expected: unknown, message?: string): void {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) throw new Error(message ? `${message}: expected ${e}, got ${a}` : `expected ${e}, got ${a}`);
  },
};

const resetLevelCustom = (custom: Custom, level: Level, idx: number): Custom => ({
  boardsByLevel: { ...custom.boardsByLevel, [idx]: new Array(level.n).fill(0) },
});

function baseState(overrides: Partial<ProgressState<Level, Custom>> = {}): ProgressState<Level, Custom> {
  return {
    generatedLevels: { 0: { n: 5 }, 1: { n: 6 }, 2: { n: 6 }, 3: { n: 7 } },
    custom: { boardsByLevel: { 0: [1, 1, 0, 0, 0], 1: [0, 0, 0, 0, 0, 0], 2: [1, 0, 0, 0, 0, 0], 3: [0, 0, 0, 0, 0, 0, 0] } },
    levelsCompleted: [0],
    levelsSkipped: [1],
    tutorialsSeen: [],
    skillRating: 45,
    recentFingerprints: [],
    hintsUsedByLevel: { 0: 1, 2: 1 },
    selectedTier: 'medium',
    unlockedTier: 'medium',
    seenUnlockedTier: 'medium',
    ...overrides,
  };
}

const checks: Array<[string, () => void]> = [
  [
    'band edges map to the right tier',
    () => {
      assert.equal(tierForRating(0), 'easy');
      assert.equal(tierForRating(39), 'easy');
      assert.equal(tierForRating(40), 'medium');
      assert.equal(tierForRating(59), 'medium');
      assert.equal(tierForRating(60), 'hard');
      assert.equal(tierForRating(79), 'hard');
      assert.equal(tierForRating(80), 'expert');
      assert.equal(tierForRating(100), 'expert');
    },
  ],
  [
    'clamping and floors stay inside the band',
    () => {
      assert.equal(clampToTier(75, 'easy'), 39);
      assert.equal(clampToTier(10, 'hard'), 60);
      assert.equal(effectiveRating(52, 'medium'), 52);
      assert.equal(tierFloor(72), 60);
      assert.equal(tierFloor(20), 0);
    },
  ],
  [
    'unlock ordering',
    () => {
      assert.ok(isTierUnlocked('easy', 'medium'));
      assert.ok(isTierUnlocked('medium', 'medium'));
      assert.ok(!isTierUnlocked('hard', 'medium'));
      assert.equal(nextTier('medium'), 'hard');
      assert.equal(nextTier('expert'), null);
    },
  ],
  [
    'new player at 40 starts on Medium with Easy + Medium unlocked',
    () => {
      const tiers = resolvePersistedTiers({}, 40);
      assert.deepEqual(tiers, { selectedTier: 'medium', unlockedTier: 'medium', seenUnlockedTier: 'medium' });
    },
  ],
  [
    'pre-tier saves back-fill from their earned rating',
    () => {
      assert.deepEqual(resolvePersistedTiers({}, 72), { selectedTier: 'hard', unlockedTier: 'hard', seenUnlockedTier: 'hard' });
      assert.deepEqual(resolvePersistedTiers({}, 12), { selectedTier: 'easy', unlockedTier: 'easy', seenUnlockedTier: 'easy' });
    },
  ],
  [
    'corrupt or locked persisted selection falls back safely',
    () => {
      const tiers = resolvePersistedTiers({ selectedTier: 'expert', unlockedTier: 'medium', seenUnlockedTier: 'bogus' }, 45);
      assert.equal(tiers.selectedTier, 'medium');
      assert.equal(tiers.unlockedTier, 'medium');
      assert.equal(tiers.seenUnlockedTier, 'medium');
    },
  ],
  [
    'reaching a new band unlocks it without switching',
    () => {
      const next = withRating(baseState({ skillRating: 59 }), 62);
      assert.equal(next.unlockedTier, 'hard');
      assert.equal(next.selectedTier, 'medium');
    },
  ],
  [
    'dropping in rating never re-locks a tier',
    () => {
      const next = withRating(baseState({ unlockedTier: 'hard' }), 20);
      assert.equal(next.unlockedTier, 'hard');
    },
  ],
  [
    'unplayed indices exclude completed and skipped levels',
    () => {
      assert.deepEqual(unplayedLevelIndices([0, 1, 2, 3], [0], [1]), [2, 3]);
    },
  ],
  [
    'switching tier drops only unplayed levels and their hints',
    () => {
      const next = withTierSwitch(baseState(), 'easy', resetLevelCustom);
      assert.equal(next.selectedTier, 'easy');
      assert.deepEqual(Object.keys(next.generatedLevels).map(Number), [0, 1]);
      assert.deepEqual(next.hintsUsedByLevel, { 0: 1 });
      assert.deepEqual(next.custom.boardsByLevel[0], [1, 1, 0, 0, 0], 'completed level board untouched');
      assert.deepEqual(next.custom.boardsByLevel[2], [0, 0, 0, 0, 0, 0], 'unplayed board reset');
    },
  ],
  [
    'started detection: hints, board edits, untouched',
    () => {
      const state = baseState();
      assert.ok(isLevelTouched(state, 2, resetLevelCustom), 'hint spent');
      assert.ok(!isLevelTouched(state, 3, resetLevelCustom), 'fresh board');
      const edited = baseState({ custom: { boardsByLevel: { ...state.custom.boardsByLevel, 3: [0, 1, 0, 0, 0, 0, 0] } } });
      assert.ok(isLevelTouched(edited, 3, resetLevelCustom), 'board edited');
      assert.ok(!isLevelTouched(state, 9, resetLevelCustom), 'not generated yet');
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
if (failed > 0) throw new Error(`${failed} difficulty check(s) failed`);
