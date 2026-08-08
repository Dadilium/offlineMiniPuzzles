import * as Updates from 'expo-updates';

/**
 * Silently checks for and downloads an OTA update in the background. Never
 * blocks startup and never reloads -- a fetched update only takes effect the
 * next time the app is cold-started naturally, so an in-progress puzzle is
 * never interrupted by a forced reload.
 */
export async function checkForUpdates(onError: (error: unknown) => void): Promise<void> {
  if (__DEV__ || !Updates.isEnabled) {
    console.log(`[ota] skipped -- __DEV__=${__DEV__} isEnabled=${Updates.isEnabled}`);
    return;
  }

  try {
    console.log('[ota] checking for update...');
    const result = await Updates.checkForUpdateAsync();
    if (result.isAvailable) {
      console.log('[ota] update available, fetching...');
      await Updates.fetchUpdateAsync();
      console.log('[ota] fetch complete, will apply on next cold start');
    } else {
      console.log('[ota] no update available');
    }
  } catch (error) {
    console.log('[ota] check/fetch failed', error);
    onError(error);
  }
}
