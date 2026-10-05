// Pure scheduling rules for the 20:00 daily reminder -- no React/native
// imports, so they can be checked in isolation
// (src/reminders/__scripts__/reminderSchedule.check.ts).
//
// Local notifications can't ask "has the player solved today's daily?" at
// the moment they fire, so instead the whole schedule is rebuilt from
// scratch every time the app is foregrounded and on every daily solve:
// cancel ours, schedule the next 14 days fresh. Each rebuild knows the truth
// about today, so a solved day's reminder is simply never (re)scheduled.
// If the player stops opening the app, the reminders run out after two
// weeks instead of nagging forever.
import { dayNumberForKey, localDayKey } from '../daily/calendar';

export const REMINDER_HOUR = 20;
export const REMINDER_DAYS = 14;
/** Prefix on every reminder's notification id, so a rebuild only ever cancels our own. */
export const REMINDER_ID_PREFIX = 'daily-reminder-';
/** Number of generic copy variants (`reminders.generic.<n>.*`), rotated by day. */
export const GENERIC_VARIANTS = 3;

export interface ReminderPlanInput {
  now: Date;
  enabled: boolean;
  /** At least one game's daily is solved today -- what keeps the overall streak alive. */
  solvedToday: boolean;
  /** Current overall daily streak (alive through yesterday, or today if solved). */
  streak: number;
}

export type PlannedReminder =
  | { id: string; date: Date; dayNumber: number; kind: 'streak'; streak: number }
  | { id: string; date: Date; dayNumber: number; kind: 'generic'; variant: number };

/** 20:00 local on the calendar day `offset` days after `now` -- built from local
 * date parts, so a DST switch in between never shifts it off 20:00. */
function reminderTime(now: Date, offset: number): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, REMINDER_HOUR, 0, 0, 0);
}

export function planReminders({ now, enabled, solvedToday, streak }: ReminderPlanInput): PlannedReminder[] {
  if (!enabled) return [];

  // Today only while it's still useful: not solved yet, and 20:00 not passed.
  const includeToday = !solvedToday && now.getTime() < reminderTime(now, 0).getTime();
  const firstOffset = includeToday ? 0 : 1;

  // The streak number is frozen into the text at scheduling time, so only
  // the first reminder may quote it -- and only when it's guaranteed to
  // still be true then: today's (streak alive through yesterday), or
  // tomorrow's when today is already solved. Past 20:00 with today unsolved,
  // tomorrow's streak depends on tonight, so it stays generic (a solve
  // tonight triggers a rebuild anyway).
  const firstMayQuoteStreak = streak > 0 && (includeToday || solvedToday);

  return Array.from({ length: REMINDER_DAYS }, (_, i): PlannedReminder => {
    const date = reminderTime(now, firstOffset + i);
    const dayNumber = dayNumberForKey(localDayKey(date));
    const id = `${REMINDER_ID_PREFIX}${dayNumber}`;
    if (i === 0 && firstMayQuoteStreak) return { id, date, dayNumber, kind: 'streak', streak };
    return { id, date, dayNumber, kind: 'generic', variant: dayNumber % GENERIC_VARIANTS };
  });
}
