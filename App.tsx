// Both of these patch native behavior at import time and must stay the very
// first imports in the app's entry file, in this order (Reanimated's own
// setup docs list it before gesture-handler).
import 'react-native-reanimated';
import 'react-native-gesture-handler';
import './src/i18n';
import React, { useCallback, useEffect, useRef } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SystemUI from 'expo-system-ui';
import { StatusBar } from 'expo-status-bar';
import { DarkTheme, DefaultTheme, NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import RootNavigator from './src/navigation/RootNavigator';
import { ToastProvider } from './src/components/Toast';
import AdBanner from './src/components/AdBanner';
import { HintWalletProvider } from './src/state/hintWallet';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import * as Sentry from '@sentry/react-native';
import { PostHogProvider } from 'posthog-react-native';
import { posthog } from './src/config/posthog';
import { runStartupTasks } from './src/startup/bootstrap';
import { checkForUpdates } from './src/startup/updates';
import { getVersionLabel } from './src/startup/version';
import ErrorBoundary from './src/components/ErrorBoundary';
import type { RootStackParamList } from './src/navigation/types';

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
    ...defaults,
    Sentry.mobileReplayIntegration(),
    Sentry.feedbackIntegration(),
  ],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

const versionLabel = getVersionLabel();
Sentry.setTag('app_build', versionLabel);
posthog?.register({ app_build: versionLabel });

export default Sentry.wrap(function App() {
  useEffect(() => {
    runStartupTasks((error) => Sentry.captureException(error)).finally(() => {
      SplashScreen.hideAsync().catch(() => {});
    });
    checkForUpdates((error) => Sentry.captureException(error));
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <ThemeProvider>
          <ToastProvider>
            <HintWalletProvider>
              <AppContent />
            </HintWalletProvider>
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
});

function AppContent() {
  const { colors, scheme } = useTheme();

  // PostHog's own screen-autocapture hook calls `useNavigationState` eagerly
  // during render, before the NavigationContainer's state is committed --
  // that throws once on every cold start. Tracking screens ourselves off the
  // container's own ref/callbacks (never called before the state exists)
  // avoids the race entirely; `captureScreens: false` below turns their
  // version off so we don't double-track.
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const lastTrackedRoute = useRef<string | undefined>(undefined);
  const trackScreen = useCallback(() => {
    const routeName = navigationRef.getCurrentRoute()?.name;
    if (routeName && routeName !== lastTrackedRoute.current) {
      lastTrackedRoute.current = routeName;
      posthog?.screen(routeName);
    }
  }, [navigationRef]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bgDeep).catch(() => {});
  }, [colors.bgDeep]);

  const navTheme = {
    dark: scheme === 'dark',
    fonts: (scheme === 'dark' ? DarkTheme : DefaultTheme).fonts,
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
    <View style={{ flex: 1, backgroundColor: colors.bgDeep }}>
      <View style={{ flex: 1 }}>
        <NavigationContainer
          ref={navigationRef}
          theme={navTheme}
          onReady={trackScreen}
          onStateChange={trackScreen}
        >
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <ErrorBoundary>
            {posthog ? (
              <PostHogProvider client={posthog} autocapture={{ captureScreens: false }}>
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
  );
}
