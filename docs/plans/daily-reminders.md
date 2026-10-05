# Daily Reminders (local notifications)

**Status:** implemented 2026-10-05; needs one EAS build (new native module), not yet verified on device
**Priority:** follow-up to `daily-puzzle.md`

## Why
Remind players to come back for their daily and protect their streak. No server: only local notifications.

## Design
- One reminder time: **20:00 local**, nothing else.
- **Rebuild, don't patch:** every time the app comes to the foreground, and on every change that matters (a daily solved, the streak, the day, the language, the opt-in), cancel all of our notifications (id prefix `daily-reminder-`) and schedule the next **14 days** fresh.
  - Today is included only if no daily is solved yet and it's before 20:00.
  - So solving any daily drops today's reminder, and opening the app tops the schedule back up to 14 days.
  - If the player stops opening the app, the reminders run out after two weeks.
- "Completing the daily" = at least one game's daily solved that day (what keeps the overall streak alive).
- **Copy:** only the first reminder may quote the streak ("Your 🔥 6-day streak ends tonight"), and only when it's guaranteed true at fire time. All others rotate 3 generic variants. EN + FR.
- **Permission:**
  - Never asked at launch. A one-time in-app prompt ("Keep your streak alive?") shows where the player lands after their first daily solve (Library or the game hub), and only a "Remind me" leads to the OS prompt.
  - Settings has a switch. If the OS permission was refused, the row says so and taps through to the OS settings.

## Files
- `src/reminders/reminderSchedule.ts`: pure plan (`planReminders`), checked by `__scripts__/reminderSchedule.check.ts`.
- `src/reminders/notifications.ts`: guarded `require('expo-notifications')` (OTA-safe on older binaries), permission, and replace-all scheduling. Android channel `daily-reminders`.
- `src/reminders/reminderCopy.ts`: localized text per planned reminder.
- `src/reminders/DailyRemindersProvider.tsx`: opt-in (`@signal-arcade/reminders/v1`), permission, rebuild triggers, analytics.
- `src/reminders/ReminderPrompt.tsx`: the one-time ask (Library + game hub).
- Settings: "Daily reminder" row.

## Analytics
`reminder_prompt_shown`, `reminder_prompt_accepted`, `reminder_prompt_declined`, `reminder_permission_result { granted }`, `reminder_toggled { enabled }`.

## Before shipping
- Needs an EAS build (`expo-notifications` added to package.json + `app.json` plugins). Bundle with the next planned build (sound effects is also native).
- Android icon: done. `assets/notification-icon.png` (96×96, white-on-transparent 3×3 grid, two lit tiles opaque, rest at 42% alpha) is wired via the plugin's `icon` option, with `color` set to `#3563e9`. Regenerate with `python3 tools/assets/notification_icon.py [--preview out.png]`.
- iOS: local notifications need no Apple capability, review form or privacy-label change. The `expo-notifications` plugin still adds the Push Notifications entitlement (`aps-environment`) by default. EAS enables that capability on the App ID during the next build (it may ask to update the provisioning profile). It's harmless, and leaves the door open for push later.
- Android 13+: the module adds `POST_NOTIFICATIONS`. No Play Console declaration needed; the Data safety form is unchanged (nothing leaves the device).
- On device, check:
  - the prompt → OS prompt flow on iOS and Android 13+
  - a reminder firing at 20:00
  - solving a daily removes today's reminder
  - turning the switch off clears the schedule
