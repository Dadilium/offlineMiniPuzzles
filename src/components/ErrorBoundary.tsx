import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Sentry from '@sentry/react-native';
import { posthog } from '../config/posthog';
import { createThemedStyles } from '../theme/createThemedStyles';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, radii, spacing } from '../theme/tokens';

type Props = { children: React.ReactNode };
type State = { hasError: boolean };

/** Fallback shown in place of the crashed tree. A function component (not
 * part of the class below) so it can use theme/i18n hooks -- error boundaries
 * themselves must stay classes for `getDerivedStateFromError`. */
function ErrorFallback({ onReset }: { onReset: () => void }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useStyles();

  return (
    <SafeAreaView style={styles.screen}>
      <Animated.View entering={FadeInDown.duration(320)} style={styles.card}>
        <Ionicons name="alert-circle" size={48} color={colors.signalRed} style={styles.icon} />
        <Text style={styles.title}>{t('error.title')}</Text>
        <Text style={styles.message}>{t('error.message')}</Text>
        <TouchableOpacity style={styles.button} onPress={onReset} activeOpacity={0.85}>
          <Text style={styles.buttonText}>{t('actions.backToLibrary')}</Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

/**
 * A single boundary reporting to both Sentry and PostHog. PostHog's own
 * `PostHogErrorBoundary` only reports to PostHog, and nesting it with
 * `Sentry.ErrorBoundary` doesn't help -- React only invokes the nearest
 * ancestor boundary to a thrown error, so whichever one is innermost would
 * swallow the error before the other ever sees it.
 *
 * Resetting `hasError` remounts `children` (the whole `RootNavigator`,
 * including its `GameProviders`) fresh -- since Library is the first
 * `Stack.Screen`, that alone lands the player back there with no navigation
 * state to reconcile.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    Sentry.captureException(error);
    posthog?.captureException(error, { componentStack: errorInfo.componentStack ?? null });
  }

  reset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onReset={this.reset} />;
    }
    return this.props.children;
  }
}

const useStyles = createThemedStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bgDeep, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    paddingVertical: 26,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '86%',
  },
  icon: { marginBottom: 12 },
  title: { fontFamily: fonts.display, fontWeight: '700', fontSize: 18, color: colors.text, marginBottom: 6, textAlign: 'center' },
  message: { fontSize: 13, color: colors.textDim, marginBottom: 20, textAlign: 'center', lineHeight: 18 },
  button: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 24, alignSelf: 'stretch', alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
}));
