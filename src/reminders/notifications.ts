import { Platform } from 'react-native';
import { REMINDER_ID_PREFIX } from './reminderSchedule';

// A static `import` throws at bundle-evaluation time if the native module
// isn't linked into the running binary -- and an OTA update can reach an
// older binary that predates expo-notifications. Same guard as
// startup/version.ts: degrade to "reminders unavailable" instead of crashing.
let Notifications: typeof import('expo-notifications') | null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Notifications = require('expo-notifications');
} catch {
  Notifications = null;
}

const ANDROID_CHANNEL_ID = 'daily-reminders';

export type ReminderPermission = 'granted' | 'denied' | 'undetermined' | 'unavailable';

export interface ReminderNotification {
  id: string;
  date: Date;
  title: string;
  body: string;
}

export function remindersAvailable(): boolean {
  return Notifications !== null && Platform.OS !== 'web';
}

/** Android 8+ only delivers through a channel, and Android 13+ needs one to
 * exist before the permission prompt can show -- so it's ensured first. */
async function ensureAndroidChannel(channelName: string): Promise<void> {
  if (!Notifications || Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: channelName,
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function getReminderPermission(): Promise<ReminderPermission> {
  if (!Notifications || !remindersAvailable()) return 'unavailable';
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
  } catch {
    return 'unavailable';
  }
}

/** Shows the OS prompt (only ever shown once by the OS -- after a "no", this just reports denied). */
export async function requestReminderPermission(channelName: string): Promise<ReminderPermission> {
  if (!Notifications || !remindersAvailable()) return 'unavailable';
  try {
    await ensureAndroidChannel(channelName);
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'unavailable';
  }
}

/**
 * Cancels every reminder this app scheduled (by id prefix -- nothing else is
 * touched) and schedules `next` in their place. Idempotent: running it
 * twice in a row leaves exactly `next` scheduled.
 */
export async function replaceReminders(next: ReminderNotification[], channelName: string): Promise<void> {
  if (!Notifications || !remindersAvailable()) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(REMINDER_ID_PREFIX))
      .map((n) => Notifications!.cancelScheduledNotificationAsync(n.identifier))
  );
  if (next.length === 0) return;
  await ensureAndroidChannel(channelName);
  const now = Date.now();
  await Promise.all(
    next
      .filter((n) => n.date.getTime() > now)
      .map((n) =>
        Notifications!.scheduleNotificationAsync({
          identifier: n.id,
          content: { title: n.title, body: n.body, sound: 'default', data: { kind: 'daily-reminder' } },
          trigger: { type: Notifications!.SchedulableTriggerInputTypes.DATE, date: n.date, channelId: ANDROID_CHANNEL_ID },
        })
      )
  );
}
