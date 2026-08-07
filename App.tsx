import './src/i18n';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import RootNavigator from './src/navigation/RootNavigator';
import { ToastProvider } from './src/components/Toast';
import AdBanner from './src/components/AdBanner';
import { HintWalletProvider } from './src/state/hintWallet';
import { colors } from './src/theme/colors';
import * as Sentry from '@sentry/react-native';
import { PostHogProvider } from 'posthog-react-native';
import { posthog } from './src/config/posthog';
import { runStartupTasks } from './src/startup/bootstrap';
import ErrorBoundary from './src/components/ErrorBoundary';

SplashScreen.preventAutoHideAsync().catch(() => {});

Sentry.init({
  dsn: 'https://7d85d1b384a74779b5a811e55a9e746e@o4511837045784576.ingest.de.sentry.io/4511837059809360',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: true,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: (defaults) => [
    // Crashes trying to optionally hook into `expo-updates`, which this project
    // doesn't use (no EAS Update/OTA updates) -- drop it rather than installing
    // an update pipeline just to satisfy it.
    ...defaults.filter((integration) => integration.name !== 'ExpoUpdatesListener'),
    Sentry.mobileReplayIntegration(),
    Sentry.feedbackIntegration(),
  ],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

export default Sentry.wrap(function App() {
  useEffect(() => {
    runStartupTasks((error) => Sentry.captureException(error)).finally(() => {
      SplashScreen.hideAsync().catch(() => {});
    });
  }, []);

  const navTheme = {
    dark: true,
    colors: {
      primary: colors.accent,
      background: colors.bgDeep,
      card: colors.bg,
      text: colors.text,
      border: colors.border,
      notification: colors.accentBright,
    },
  };

  return (
    <SafeAreaProvider>
      <ToastProvider>
        <HintWalletProvider>
          <View style={styles.appRoot}>
            <View style={styles.navigatorSlot}>
              <NavigationContainer theme={navTheme}>
                <StatusBar style="light" />
                <ErrorBoundary>
                  {posthog ? (
                    <PostHogProvider client={posthog}>
                      <RootNavigator />
                    </PostHogProvider>
                  ) : (
                    <RootNavigator />
                  )}
                </ErrorBoundary>
              </NavigationContainer>
            </View>
            {/* Mounted once here rather than per-screen, so navigating between
             * screens reuses this single native ad instance instead of
             * requesting a new one on every push. */}
            <AdBanner />
          </View>
        </HintWalletProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
});

const styles = StyleSheet.create({
  appRoot: { flex: 1, backgroundColor: colors.bgDeep },
  navigatorSlot: { flex: 1 },
});
