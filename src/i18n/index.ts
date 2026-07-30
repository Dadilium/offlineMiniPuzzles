import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import { detectSupportedLanguage } from './detectLanguage';

import commonEn from './locales/common/en.json';
import commonFr from './locales/common/fr.json';
import colorSortEn from '../games/color-sort/locales/en.json';
import colorSortFr from '../games/color-sort/locales/fr.json';
import kingsEn from '../games/kings/locales/en.json';
import kingsFr from '../games/kings/locales/fr.json';
import matchingNumbersEn from '../games/matching-numbers/locales/en.json';
import matchingNumbersFr from '../games/matching-numbers/locales/fr.json';
import blockFillEn from '../games/block-fill/locales/en.json';
import blockFillFr from '../games/block-fill/locales/fr.json';
import crossSumsEn from '../games/cross-sums/locales/en.json';
import crossSumsFr from '../games/cross-sums/locales/fr.json';
import tentsAndTreesEn from '../games/tents-and-trees/locales/en.json';
import tentsAndTreesFr from '../games/tents-and-trees/locales/fr.json';
import shikakuEn from '../games/shikaku/locales/en.json';
import shikakuFr from '../games/shikaku/locales/fr.json';
import relayEn from '../games/relay/locales/en.json';
import relayFr from '../games/relay/locales/fr.json';

export const SUPPORTED_LANGUAGES = ['en', 'fr'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

// Every namespace the app ships, aggregated by language. Each game registers
// its own namespace here (keyed by its GameModule id) alongside common --
// mirrors the explicit-import style of src/games/registry.ts so a new game
// adds exactly one import + one entry per language, same as registering
// there.
export const resources = {
  en: {
    common: commonEn,
    'color-sort': colorSortEn,
    kings: kingsEn,
    'matching-numbers': matchingNumbersEn,
    'block-fill': blockFillEn,
    'cross-sums': crossSumsEn,
    'tents-and-trees': tentsAndTreesEn,
    shikaku: shikakuEn,
    relay: relayEn,
  },
  fr: {
    common: commonFr,
    'color-sort': colorSortFr,
    kings: kingsFr,
    'matching-numbers': matchingNumbersFr,
    'block-fill': blockFillFr,
    'cross-sums': crossSumsFr,
    'tents-and-trees': tentsAndTreesFr,
    shikaku: shikakuFr,
    relay: relayFr,
  },
} as const;

const language = detectSupportedLanguage(Localization.getLocales(), SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE);

i18next.use(initReactI18next).init({
  resources,
  lng: language,
  fallbackLng: DEFAULT_LANGUAGE,
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18next;
