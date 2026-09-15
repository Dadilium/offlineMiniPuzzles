import { AppState } from 'react-native';

/** Resolves after `ms` milliseconds. */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const DEFAULT_ACTIVE_TIMEOUT_MS = 10000;

/**
 * Resolves once the app is confirmed foregrounded and active (`AppState`
 * reports `'active'`). Several iOS system prompts -- App Tracking
 * Transparency chief among them -- only ever present while the app is in
 * `UIApplicationStateActive`. Asking any earlier (mid-launch, mid-transition,
 * while another view controller is still being presented or dismissed)
 * doesn't error and doesn't queue the request either -- it just resolves as
 * `notDetermined`, indistinguishable from the user simply not having
 * answered yet. Confirming `active` first is what turns "usually shows up"
 * into "reliably shows up".
 *
 * Falls back to resolving after `timeoutMs` so a stuck subscription (or an
 * app that never becomes active -- some CI/test harnesses, for instance)
 * can never hang startup forever.
 */
export function waitUntilAppActive(timeoutMs: number = DEFAULT_ACTIVE_TIMEOUT_MS): Promise<void> {
  if (AppState.currentState === 'active') return Promise.resolve();

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      subscription.remove();
      clearTimeout(timeout);
      resolve();
    };

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') finish();
    });
    const timeout = setTimeout(finish, timeoutMs);
  });
}
