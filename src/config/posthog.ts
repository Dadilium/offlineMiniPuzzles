import PostHog from 'posthog-react-native';
import Constants from 'expo-constants';

type PostHogConfig = {
  projectToken?: string;
  host?: string;
};

const config = (Constants.expoConfig?.extra?.posthog ?? {}) as PostHogConfig;
const projectToken = config.projectToken;
const host = config.host;
const isConfigured = Boolean(projectToken && host);

if (__DEV__ && !isConfigured) {
  throw new Error(
    'POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured',
  );
}

export const posthog = isConfigured
  ? new PostHog(projectToken as string, {
      host: host as string,
      captureAppLifecycleEvents: true,
      preloadFeatureFlags: true,
    })
  : null;

