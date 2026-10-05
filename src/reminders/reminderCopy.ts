import type { TFunction } from 'i18next';
import { translateDynamic } from '../i18n/dynamicKey';
import type { ReminderNotification } from './notifications';
import type { PlannedReminder } from './reminderSchedule';

/** Localized notification text for a planned reminder. `t` must be bound to
 * the `common` namespace; the language is baked in at scheduling time, so a
 * language switch triggers a rebuild (see DailyRemindersProvider). */
export function toNotification(t: TFunction<'common'>, planned: PlannedReminder): ReminderNotification {
  if (planned.kind === 'streak') {
    return {
      id: planned.id,
      date: planned.date,
      title: t('reminders.streakTitle', { count: planned.streak }),
      body: t('reminders.streakBody'),
    };
  }
  return {
    id: planned.id,
    date: planned.date,
    title: translateDynamic(t, `reminders.generic.${planned.variant}.title`),
    body: translateDynamic(t, `reminders.generic.${planned.variant}.body`),
  };
}
