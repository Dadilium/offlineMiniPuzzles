import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import { posthog } from '../config/posthog';
import { useDailyResults } from '../daily/DailyResultsProvider';
import {
  getReminderPermission,
  remindersAvailable,
  replaceReminders,
  requestReminderPermission,
  type ReminderPermission,
} from './notifications';
import { toNotification } from './reminderCopy';
import { planReminders } from './reminderSchedule';

const STORAGE_KEY = '@signal-arcade/reminders/v1';

interface ReminderPreference {
  /** What the player chose. Reminders actually fire only while the OS permission is granted too. */
  enabled: boolean;
  /** The in-app "Keep your streak alive?" ask has been answered (either way) -- it's shown once. */
  prompted: boolean;
}

const DEFAULT_PREFERENCE: ReminderPreference = { enabled: false, prompted: false };

function sanitizePreference(raw: unknown): ReminderPreference {
  const p = raw as Partial<ReminderPreference> | null;
  return {
    enabled: typeof p?.enabled === 'boolean' ? p.enabled : false,
    prompted: typeof p?.prompted === 'boolean' ? p.prompted : false,
  };
}

interface DailyRemindersContextValue {
  /** False on a binary without expo-notifications (reachable via OTA) -- hide every reminder UI. */
  available: boolean;
  /** The player's own choice -- what the Settings switch shows. */
  optedIn: boolean;
  /** Reminders will actually fire: the player opted in AND the OS allows it. */
  active: boolean;
  /** Opted in, but notifications are blocked in the OS settings. */
  blockedBySystem: boolean;
  /** The one-time opt-in ask is due: the player has just solved a daily and hasn't been asked yet. */
  promptVisible: boolean;
  acceptPrompt: () => void;
  dismissPrompt: () => void;
  /** Settings toggle. Turning on asks the OS when needed, or opens the OS settings if it was refused before. */
  setEnabled: (enabled: boolean) => void;
}

const DailyRemindersContext = createContext<DailyRemindersContextValue | null>(null);

/**
 * Owns the 20:00 daily reminder: the player's opt-in, the OS permission, and
 * keeping the 14-day schedule in sync. The schedule is rebuilt from scratch
 * (see `planReminders`) whenever anything it depends on changes -- a daily
 * solved (drops today's reminder), the streak, the day, the language -- and
 * every time the app returns to the foreground, which also tops it back up
 * to a full 14 days.
 */
export function DailyRemindersProvider({ children }: { children: React.ReactNode }) {
  const { t, i18n } = useTranslation('common');
  const results = useDailyResults();
  const available = remindersAvailable();
  const [preference, setPreference] = useState<ReminderPreference>(DEFAULT_PREFERENCE);
  const [loaded, setLoaded] = useState(false);
  const [permission, setPermission] = useState<ReminderPermission>('undetermined');
  const [foregroundTick, setForegroundTick] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        setPreference(sanitizePreference(raw ? JSON.parse(raw) : null));
      } catch {
        // corrupt/missing storage -- defaults already set
      }
      setPermission(await getReminderPermission());
      setLoaded(true);
    })();
  }, []);

  const savePreference = useCallback((next: ReminderPreference) => {
    setPreference(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  // Coming back to the app is when the schedule gets topped up -- and when a
  // permission change made in the OS settings is picked up.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      getReminderPermission().then(setPermission);
      setForegroundTick((tick) => tick + 1);
    });
    return () => sub.remove();
  }, []);

  const active = available && preference.enabled && permission === 'granted';
  const channelName = t('reminders.channelName');

  // Rebuilds are chained so a cancel-then-schedule pass never interleaves
  // with another one (e.g. a solve landing right as the app foregrounds).
  const rebuildChain = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    if (!available || !loaded || !results.ready) return;
    const plan = planReminders({
      now: new Date(),
      enabled: active,
      solvedToday: results.solvedAnyToday,
      streak: results.overallStreak.current,
    });
    const notifications = plan.map((planned) => toNotification(t, planned));
    rebuildChain.current = rebuildChain.current.then(() => replaceReminders(notifications, channelName)).catch(() => {});
  }, [
    available,
    loaded,
    active,
    results.ready,
    results.solvedAnyToday,
    results.overallStreak.current,
    results.today,
    i18n.language,
    foregroundTick,
    t,
    channelName,
  ]);

  const turnOn = useCallback(async () => {
    const current = await getReminderPermission();
    if (current === 'granted') {
      setPermission('granted');
      return true;
    }
    if (current === 'undetermined') {
      const answer = await requestReminderPermission(channelName);
      setPermission(answer);
      return answer === 'granted';
    }
    // Refused before: the OS won't prompt again, so its settings are the only way back.
    if (current === 'denied') Linking.openSettings().catch(() => {});
    return false;
  }, [channelName]);

  const acceptPrompt = useCallback(() => {
    posthog?.capture('reminder_prompt_accepted');
    turnOn().then((granted) => {
      posthog?.capture('reminder_permission_result', { granted });
      savePreference({ enabled: granted, prompted: true });
    });
  }, [turnOn, savePreference]);

  const dismissPrompt = useCallback(() => {
    posthog?.capture('reminder_prompt_declined');
    savePreference({ ...preference, prompted: true });
  }, [preference, savePreference]);

  const setEnabled = useCallback(
    (enabled: boolean) => {
      posthog?.capture('reminder_toggled', { enabled });
      if (!enabled) {
        savePreference({ enabled: false, prompted: true });
        return;
      }
      // Keep the opt-in even when the OS still blocks it -- it starts working
      // as soon as the player allows notifications in the OS settings.
      savePreference({ enabled: true, prompted: true });
      void turnOn();
    },
    [savePreference, turnOn]
  );

  const promptVisible = available && loaded && results.ready && !preference.prompted && !preference.enabled && results.solvedAnyToday;

  const promptShownRef = useRef(false);
  useEffect(() => {
    if (!promptVisible || promptShownRef.current) return;
    promptShownRef.current = true;
    posthog?.capture('reminder_prompt_shown');
  }, [promptVisible]);

  const value = useMemo<DailyRemindersContextValue>(
    () => ({
      available,
      optedIn: preference.enabled,
      active,
      blockedBySystem: available && preference.enabled && permission === 'denied',
      promptVisible,
      acceptPrompt,
      dismissPrompt,
      setEnabled,
    }),
    [available, active, preference.enabled, permission, promptVisible, acceptPrompt, dismissPrompt, setEnabled]
  );

  return <DailyRemindersContext.Provider value={value}>{children}</DailyRemindersContext.Provider>;
}

export function useDailyReminders(): DailyRemindersContextValue {
  const ctx = useContext(DailyRemindersContext);
  if (!ctx) throw new Error('useDailyReminders must be used within a DailyRemindersProvider');
  return ctx;
}
