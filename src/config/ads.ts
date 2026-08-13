import { Platform } from 'react-native';
import { AdsConsent, AdsConsentStatus, MobileAds, TestIds } from 'react-native-google-mobile-ads';
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';

export type GameId =
  | 'kings'
  | 'matching-numbers'
  | 'block-fill'
  | 'cross-sums'
  | 'color-sort'
  | 'tents-and-trees'
  | 'shikaku'
  | 'find-words';

type AdFormat = 'banner' | 'interstitial' | 'rewarded';

const PROD_AD_UNIT_IDS: Record<'ios' | 'android', Record<AdFormat, string>> = {
  ios: {
    banner: 'ca-app-pub-2631204280172241/1100819476',
    interstitial: 'ca-app-pub-2631204280172241/3601045641',
    rewarded: 'ca-app-pub-2631204280172241/9773516413',
  },
  android: {
    banner: 'ca-app-pub-2631204280172241/5844065609',
    interstitial: 'ca-app-pub-2631204280172241/9919041981',
    rewarded: 'ca-app-pub-2631204280172241/4656921102',
  },
};

const TEST_AD_UNIT_IDS: Record<AdFormat, string> = {
  banner: TestIds.BANNER,
  interstitial: TestIds.INTERSTITIAL,
  rewarded: TestIds.REWARDED,
};

function adUnitId(format: AdFormat): string {
  if (__DEV__) return TEST_AD_UNIT_IDS[format];
  return PROD_AD_UNIT_IDS[Platform.OS === 'ios' ? 'ios' : 'android'][format];
}

export const adUnitIds = {
  banner: adUnitId('banner'),
  interstitial: adUnitId('interstitial'),
  rewarded: adUnitId('rewarded'),
};

// Interstitial cadence, per game: no ad until `first` levels are completed
// (lets a new player get into the game before seeing one), then every
// `interval` levels after that. Falls back to the defaults below -- override
// per game for levels that run noticeably shorter or longer than average.
const DEFAULT_INTERSTITIAL_FIRST = 5;
const DEFAULT_INTERSTITIAL_INTERVAL = 3;
const INTERSTITIAL_FIRST_OVERRIDES: Partial<Record<GameId, number>> = {
  'matching-numbers': 2,
  'find-words': 3,
};
const INTERSTITIAL_INTERVAL_OVERRIDES: Partial<Record<GameId, number>> = {
  'matching-numbers': 2,
  'find-words': 2,
};

export interface InterstitialSchedule {
  first: number;
  interval: number;
}

export function interstitialScheduleFor(gameId: GameId): InterstitialSchedule {
  return {
    first: INTERSTITIAL_FIRST_OVERRIDES[gameId] ?? DEFAULT_INTERSTITIAL_FIRST,
    interval: INTERSTITIAL_INTERVAL_OVERRIDES[gameId] ?? DEFAULT_INTERSTITIAL_INTERVAL,
  };
}

/** Matching Numbers' Add Numbers assist gets its own interstitial cadence,
 * tracked independently of level completions -- an ad every other press. */
export const MATCHING_NUMBERS_ADD_NUMBERS_AD_SCHEDULE: InterstitialSchedule = { first: 2, interval: 2 };

export interface InterstitialState {
  /** Level completions since the last interstitial the player actually
   * watched through to close. */
  sinceLastAd: number;
  /** Whether any interstitial has ever been shown to completion -- before
   * the first one, `schedule.first` is the threshold; after, `interval` is. */
  everShownAd: boolean;
  /** True from the moment an ad is due until it's confirmed closed. If the
   * app is killed mid-ad (or the ad wasn't loaded at all), this survives
   * and forces the very next completion to retry, instead of waiting for
   * the schedule to come back around. */
  pendingRetry: boolean;
}

export const DEFAULT_INTERSTITIAL_STATE: InterstitialState = {
  sinceLastAd: 0,
  everShownAd: false,
  pendingRetry: false,
};

/** Pure decision step for one trigger event (a level completion, or any
 * other cadence-tracked action): bumps the counter and says whether an
 * interstitial is due. `forceDue` short-circuits straight to due regardless
 * of the count-based threshold (e.g. Matching Numbers forces it when a level
 * took unusually long to solve) without disturbing the counter bookkeeping.
 * Persistence is the caller's job. */
export function nextInterstitialDecision(
  state: InterstitialState,
  schedule: InterstitialSchedule,
  forceDue: boolean = false
): { due: boolean; sinceLastAd: number } {
  const sinceLastAd = state.sinceLastAd + 1;
  const threshold = state.everShownAd ? schedule.interval : schedule.first;
  const due = state.pendingRetry || forceDue || sinceLastAd >= threshold;
  return { due, sinceLastAd };
}

async function gatherConsent(): Promise<void> {
  const info = await AdsConsent.requestInfoUpdate();
  console.log('[ads] consent info', JSON.stringify(info));
  const needsForm =
    info.isConsentFormAvailable &&
    (info.status === AdsConsentStatus.REQUIRED || info.status === AdsConsentStatus.UNKNOWN);
  console.log('[ads] needsForm', needsForm);
  if (needsForm) {
    await AdsConsent.showForm();
    console.log('[ads] showForm resolved');
  }
}

// Gathers UMP consent (GDPR/CCPA), then ATT authorization on iOS, then boots
// the Mobile Ads SDK -- in that order, per Google's guidance, so the SDK
// only ever requests ads once both consent signals are settled. Safe to call
// more than once; only the first call does the work.
let initPromise: Promise<void> | null = null;

export function initAds(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await gatherConsent();
      if (Platform.OS === 'ios') {
        await requestTrackingPermissionsAsync();
      }
      await MobileAds().initialize();
    })();
  }
  return initPromise;
}
