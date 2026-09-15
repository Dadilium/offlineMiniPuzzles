import { initAds } from '../config/ads';
import { delay } from '../utils/timing';

const MIN_SPLASH_MS = 2000;

/**
 * Resolves once at least MIN_SPLASH_MS has elapsed, so the splash screen
 * never flashes instantly. Sentry/PostHog aren't awaited here -- both init
 * synchronously at module load, before the splash is even shown.
 *
 * Ad consent, App Tracking Transparency and the Mobile Ads SDK are started
 * here but deliberately NOT awaited. Gating the splash screen on them held
 * the ATT prompt hostage behind whatever the UMP network round-trip (and
 * consent form, if one showed) happened to take -- all while the app was
 * still mid-launch, which is exactly the state ATT is least likely to
 * actually present in (see initAds). Letting the splash hide on its own
 * fixed timer and running ad init in the background instead means ATT gets
 * requested once the app has properly settled into the foreground, not
 * before -- and the player gets into the game sooner besides.
 */
export function runStartupTasks(onError: (error: unknown) => void): Promise<void> {
  initAds().catch(onError);
  return delay(MIN_SPLASH_MS);
}
