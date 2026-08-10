import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = '@signal-arcade/settings/theme-mode/v1';
const VALID_MODES: readonly ThemeMode[] = ['system', 'light', 'dark'];

/** The theme the player explicitly picked in Settings -- null if they've
 * never changed it, in which case the app follows the system appearance. */
export async function getStoredThemeMode(): Promise<ThemeMode | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw && (VALID_MODES as readonly string[]).includes(raw) ? (raw as ThemeMode) : null;
}

export function setStoredThemeMode(mode: ThemeMode): void {
  AsyncStorage.setItem(STORAGE_KEY, mode).catch(() => {});
}
