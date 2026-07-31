import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@signal-arcade/settings/language/v1';

/** The language the player explicitly picked in Settings, overriding device
 * locale detection -- null if they've never changed it or the stored value
 * no longer matches a shipped language. */
export async function getStoredLanguage(supported: readonly string[]): Promise<string | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw && supported.includes(raw) ? raw : null;
}

export function setStoredLanguage(language: string): void {
  AsyncStorage.setItem(STORAGE_KEY, language).catch(() => {});
}
