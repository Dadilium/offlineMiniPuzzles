import * as Updates from 'expo-updates';

// A static `import` throws at bundle-evaluation time if the native module
// isn't linked into the running binary -- before React ever renders. An OTA
// update can reach an older binary that predates a given native dependency,
// so this has to degrade gracefully instead of crashing the whole app.
let Application: typeof import('expo-application') | null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Application = require('expo-application');
} catch {
  Application = null;
}

/**
 * Human-readable build label for logging/telemetry, e.g. "1.0.0-4-3fa2c1e0"
 * (app version - native build number - short OTA update id), or
 * "1.0.0-4-0" for the embedded bundle with no OTA update applied.
 */
export function getVersionLabel(): string {
  const appVersion = Application?.nativeApplicationVersion ?? 'unknown';
  const nativeBuild = Application?.nativeBuildVersion ?? 'unknown';
  const otaShort = Updates.isEmbeddedLaunch ? '0' : (Updates.updateId?.slice(0, 8) ?? '0');
  return `${appVersion}-${nativeBuild}-${otaShort}`;
}
