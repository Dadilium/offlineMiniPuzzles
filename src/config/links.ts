const SITE_URL = 'https://dadilium.github.io/offlineMiniPuzzles';

export const PRIVACY_POLICY_URL = `${SITE_URL}/privacy.html`;
/** Link appended to shared daily results -- legal/play.html, which sends each visitor to the right store. */
export const SHARE_LANDING_URL = `${SITE_URL}/play.html`;

/** Numeric App Store id (same as eas.json's `submit.production.ios.ascAppId`). */
export const APP_STORE_ID = '6802090640';
/** Same as app.json's `android.package`. */
export const ANDROID_PACKAGE = 'com.antoineroy.puzzleden';

/** Opens straight on the store's "write a review" screen. */
export const IOS_WRITE_REVIEW_URL = `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`;
/** Play Store app first; the web listing is the fallback when it can't open. */
export const ANDROID_STORE_URL = `market://details?id=${ANDROID_PACKAGE}`;
export const ANDROID_STORE_WEB_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
