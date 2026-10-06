import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@signal-arcade/settings/sound/v1';

/** The player's Settings choice -- null if never changed, in which case sound is on. */
export async function getStoredSoundEnabled(): Promise<boolean | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (raw === 'on') return true;
  if (raw === 'off') return false;
  return null;
}

export function setStoredSoundEnabled(value: boolean): void {
  AsyncStorage.setItem(STORAGE_KEY, value ? 'on' : 'off').catch(() => {});
}
