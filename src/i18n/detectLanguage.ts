/** Minimal shape we need from expo-localization's Locale, kept narrow so this
 * stays a pure function testable without the native module. */
export interface DetectableLocale {
  languageCode: string | null;
}

/** Picks the first device locale (in device preference order) that this app
 * actually ships a translation for, falling back otherwise. */
export function detectSupportedLanguage(
  locales: readonly DetectableLocale[],
  supported: readonly string[],
  fallback: string
): string {
  for (const locale of locales) {
    const code = locale.languageCode?.toLowerCase();
    if (code && supported.includes(code)) return code;
  }
  return fallback;
}
