/**
 * Assertion checks for the 20:00 daily reminder schedule: which days get a
 * reminder (today vs from tomorrow), the 14-day window, the streak-quoting
 * rule, ids, and DST safety. Rerun whenever reminderSchedule.ts changes.
 *
 * Run with: npx tsx src/reminders/__scripts__/reminderSchedule.check.ts
 * DST cases only bite in a zone that observes DST, so also run e.g.:
 *   TZ=Europe/Paris npx tsx src/reminders/__scripts__/reminderSchedule.check.ts
 *   TZ=America/New_York npx tsx src/reminders/__scripts__/reminderSchedule.check.ts
 */
import { dayNumberForKey, localDayKey } from '../../daily/calendar';
import { planReminders, REMINDER_DAYS, REMINDER_HOUR, REMINDER_ID_PREFIX, type PlannedReminder } from '../reminderSchedule';

// Local assert helpers rather than `node:assert` -- the app tsconfig has no
// Node types, and this script is type-checked along with the rest of src/.
const assert = {
  equal<T>(actual: T, expected: T, message?: string): void {
    if (actual !== expected) throw new Error(message ? `${message}: expected ${String(expected)}, got ${String(actual)}` : `expected ${String(expected)}, got ${String(actual)}`);
  },
};

const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min);
const keyOf = (r: PlannedReminder) => localDayKey(r.date);
const base = { enabled: true, solvedToday: false, streak: 0 };

const checks: Array<[string, () => void]> = [
  [
    'disabled: nothing scheduled',
    () => assert.equal(planReminders({ ...base, now: at(2026, 10, 5, 9), enabled: false }).length, 0),
  ],
  [
    'morning, not solved: starts today, 14 days at 20:00',
    () => {
      const plan = planReminders({ ...base, now: at(2026, 10, 5, 9) });
      assert.equal(plan.length, REMINDER_DAYS);
      assert.equal(keyOf(plan[0]), '2026-10-05');
      assert.equal(keyOf(plan[13]), '2026-10-18');
      for (const r of plan) {
        assert.equal(r.date.getHours(), REMINDER_HOUR, keyOf(r));
        assert.equal(r.date.getMinutes(), 0, keyOf(r));
      }
    },
  ],
  [
    'solved today: today dropped, starts tomorrow, still 14 days',
    () => {
      const plan = planReminders({ ...base, now: at(2026, 10, 5, 9), solvedToday: true });
      assert.equal(plan.length, REMINDER_DAYS);
      assert.equal(keyOf(plan[0]), '2026-10-06');
      assert.equal(keyOf(plan[13]), '2026-10-19');
    },
  ],
  [
    'at or after 20:00, not solved: today is past, starts tomorrow',
    () => {
      assert.equal(keyOf(planReminders({ ...base, now: at(2026, 10, 5, 20, 0) })[0]), '2026-10-06');
      assert.equal(keyOf(planReminders({ ...base, now: at(2026, 10, 5, 23, 30) })[0]), '2026-10-06');
      assert.equal(keyOf(planReminders({ ...base, now: at(2026, 10, 5, 19, 59) })[0]), '2026-10-05');
    },
  ],
  [
    'streak quoted on today\'s reminder when today is still open',
    () => {
      const plan = planReminders({ ...base, now: at(2026, 10, 5, 9), streak: 6 });
      assert.equal(plan[0].kind, 'streak');
      assert.equal(plan[0].kind === 'streak' && plan[0].streak, 6);
      assert.equal(plan.slice(1).every((r) => r.kind === 'generic'), true);
    },
  ],
  [
    'streak quoted on tomorrow\'s reminder when today is solved',
    () => {
      const plan = planReminders({ ...base, now: at(2026, 10, 5, 9), solvedToday: true, streak: 7 });
      assert.equal(plan[0].kind, 'streak');
      assert.equal(keyOf(plan[0]), '2026-10-06');
    },
  ],
  [
    'past 20:00 and unsolved: tomorrow stays generic (streak hinges on tonight)',
    () => assert.equal(planReminders({ ...base, now: at(2026, 10, 5, 21), streak: 6 })[0].kind, 'generic'),
  ],
  [
    'no streak: every reminder generic, variants rotate',
    () => {
      const plan = planReminders({ ...base, now: at(2026, 10, 5, 9) });
      assert.equal(plan.every((r) => r.kind === 'generic'), true);
      const variants = new Set(plan.map((r) => (r.kind === 'generic' ? r.variant : -1)));
      assert.equal(variants.size > 1, true);
    },
  ],
  [
    'ids are prefixed and keyed by puzzle day, so a rebuild replaces exactly ours',
    () => {
      const plan = planReminders({ ...base, now: at(2026, 10, 5, 9) });
      assert.equal(plan[0].id, `${REMINDER_ID_PREFIX}${dayNumberForKey('2026-10-05')}`);
      assert.equal(new Set(plan.map((r) => r.id)).size, plan.length);
    },
  ],
  [
    'rebuilding the same moment twice gives the same plan (idempotent)',
    () => {
      const input = { ...base, now: at(2026, 10, 5, 9), streak: 3 };
      assert.equal(JSON.stringify(planReminders(input)), JSON.stringify(planReminders(input)));
    },
  ],
  [
    'month/year rollover',
    () => {
      const plan = planReminders({ ...base, now: at(2026, 12, 25, 9) });
      assert.equal(keyOf(plan[0]), '2026-12-25');
      assert.equal(keyOf(plan[13]), '2027-01-07');
    },
  ],
  [
    'DST switches (EU 25 Oct, US 1 Nov 2026) stay at 20:00 with no skipped day',
    () => {
      const plan = planReminders({ ...base, now: at(2026, 10, 20, 9) });
      for (let i = 1; i < plan.length; i++) {
        assert.equal(plan[i].dayNumber - plan[i - 1].dayNumber, 1, keyOf(plan[i]));
        assert.equal(plan[i].date.getHours(), REMINDER_HOUR, keyOf(plan[i]));
      }
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
if (failed > 0) throw new Error(`${failed} reminder schedule check(s) failed`);
