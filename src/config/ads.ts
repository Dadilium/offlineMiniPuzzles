import { Platform } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { AdsConsent, AdsConsentStatus, MobileAds, TestIds } from 'react-native-google-mobile-ads';
import { getTrackingPermissionsAsync, requestTrackingPermissionsAsync, PermissionStatus } from 'expo-tracking-transparency';
import { delay, waitUntilAppActive } from '../utils/timing';
import { posthog } from './posthog';
import type { InterstitialSchedule } from '../ads/interstitialRules';

export type GameId =
  | 'kings'
  | 'matching-numbers'
  | 'block-fill'
  | 'cross-sums'
  | 'color-sort'
  | 'tents-and-trees'
  | 'shikaku'
  | 'find-words'
  | 'arrows';

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

export function interstitialScheduleFor(gameId: GameId): InterstitialSchedule {
  return {
    first: INTERSTITIAL_FIRST_OVERRIDES[gameId] ?? DEFAULT_INTERSTITIAL_FIRST,
    interval: INTERSTITIAL_INTERVAL_OVERRIDES[gameId] ?? DEFAULT_INTERSTITIAL_INTERVAL,
  };
}

/** Matching Numbers' Add Numbers assist gets its own interstitial cadence,
 * tracked independently of level completions -- an ad every other press. */
export const MATCHING_NUMBERS_ADD_NUMBERS_AD_SCHEDULE: InterstitialSchedule = { first: 2, interval: 2 };

/** Arrows' "Try again" after running out of hearts gets its own cadence,
 * separate from level completions -- an ad on every retry. The app-wide
 * cooldown (INTERSTITIAL_COOLDOWN_MS) still applies, so retries in quick
 * succession don't chain ads back to back. */
export const ARROWS_RETRY_AD_SCHEDULE: InterstitialSchedule = { first: 1, interval: 1 };

/** Settle time after the UMP consent form's dismiss animation before asking
 * for ATT -- see the comment on the ATT call in `initAds` for why. */
const POST_CONSENT_FORM_SETTLE_MS = 500;

/** Gathers UMP consent (GDPR/CCPA), showing the form if one is required.
 * Returns whether the form was actually shown, so the caller can give its
 * dismiss animation a moment to settle before presenting anything else. */
async function gatherConsent(): Promise<{ formShown: boolean }> {
  const info = await AdsConsent.requestInfoUpdate();
  const needsForm =
    info.isConsentFormAvailable &&
    (info.status === AdsConsentStatus.REQUIRED || info.status === AdsConsentStatus.UNKNOWN);
  if (needsForm) {
    await AdsConsent.showForm();
  }
  return { formShown: needsForm };
}

/** Logs one point in the ATT flow to both the Metro/device console (matching
 * the `[tag]` convention used elsewhere at startup, e.g. `startup/updates`)
 * and to Sentry as a structured log (`enableLogs` is on in App.tsx), so the
 * actual sequence of events -- did the user need to be asked, did the prompt
 * show, what did they choose -- is visible after the fact from a real
 * TestFlight/App Store session, on whatever OS version it ran on, without
 * needing the device in hand to reproduce it. */
function logAtt(event: string, attributes: Record<string, string> = {}): void {
  const data = { ...attributes, os: Platform.OS, osVersion: String(Platform.Version) };
  console.log(`[att] ${event}`, data);
  Sentry.logger.info(`att.${event}`, data);
}

// Gathers UMP consent (GDPR/CCPA), then ATT authorization on iOS, then boots
// the Mobile Ads SDK -- in that order, per Google's guidance, so the SDK
// only ever requests ads once both consent signals are settled. Safe to call
// more than once; only the first call does the work.
//
// UMP's requestInfoUpdate() can reject (network hiccup, region-detection
// failure, etc). That must never block the ATT prompt below it, since Apple
// requires ATT to be requested regardless -- so consent failures are caught
// and reported, not allowed to propagate.
let initPromise: Promise<void> | null = null;

export function initAds(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      let formShown = false;
      try {
        ({ formShown } = await gatherConsent());
      } catch (error) {
        Sentry.captureException(error);
      }

      if (Platform.OS === 'ios') {
        const before = await getTrackingPermissionsAsync();
        logAtt(before.status === PermissionStatus.UNDETERMINED ? 'needs_prompt' : 'already_decided', {
          status: before.status,
        });

        // iOS only ever presents the ATT alert while the app is
        // UIApplicationStateActive. Calling this any earlier -- still
        // launching, a modal mid-transition -- doesn't error and doesn't
        // queue the request either: it silently resolves `notDetermined`
        // as if the user hadn't been asked, with no signal that anything
        // was skipped. Confirming `active` first is what makes the prompt
        // reliable instead of a launch-timing race.
        await waitUntilAppActive();
        if (formShown) {
          // The UMP consent form is itself a modal; its dismiss transition
          // can still be animating for a moment after `showForm()`
          // resolves. Presenting the ATT alert while that's in flight is a
          // known way for it to get silently dropped, so give it a beat and
          // re-confirm we're still active before asking.
          await delay(POST_CONSENT_FORM_SETTLE_MS);
          await waitUntilAppActive();
        }

        logAtt('requesting');
        const after = await requestTrackingPermissionsAsync();

        if (before.status === PermissionStatus.UNDETERMINED && after.status === PermissionStatus.UNDETERMINED) {
          // Asked, but the status never moved off undetermined -- the
          // system silently declined to show the alert rather than the
          // user actually seeing and dismissing it. This is exactly the
          // failure mode behind the "ATT prompt doesn't trigger" App Review
          // rejection this whole flow was hardened against -- if this shows
          // up in production logs, the timing guard above didn't hold for
          // that launch, and it's worth checking which OS version it was.
          logAtt('prompt_did_not_appear');
        } else {
          logAtt('resolved', { status: after.status });
        }

        // A persistent property on every subsequent PostHog event (same
        // pattern as `app_build` in App.tsx), so ad/engagement metrics can
        // be segmented by consent state without a dedicated funnel.
        posthog?.register({ att_status: after.status });
      }

      await MobileAds().initialize();
    })();
  }
  return initPromise;
}
