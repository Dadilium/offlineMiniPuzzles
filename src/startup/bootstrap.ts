import { initAds } from '../config/ads';

const MIN_SPLASH_MS = 2000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Resolves once ad consent + the Mobile Ads SDK have settled (or failed) and
 * at least MIN_SPLASH_MS has elapsed, so the splash screen never flashes
 * instantly. Sentry/PostHog aren't awaited here -- both init synchronously at
 * module load, before the splash is even shown.
 */
export function runStartupTasks(onError: (error: unknown) => void): Promise<void> {
  const adsReady = initAds().catch(onError);
  return Promise.all([adsReady, delay(MIN_SPLASH_MS)]).then(() => undefined);
}
