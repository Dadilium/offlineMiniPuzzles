import React from 'react';
import * as Sentry from '@sentry/react-native';
import { posthog } from '../config/posthog';

type Props = { children: React.ReactNode };
type State = { hasError: boolean };

/**
 * A single boundary reporting to both Sentry and PostHog. PostHog's own
 * `PostHogErrorBoundary` only reports to PostHog, and nesting it with
 * `Sentry.ErrorBoundary` doesn't help -- React only invokes the nearest
 * ancestor boundary to a thrown error, so whichever one is innermost would
 * swallow the error before the other ever sees it.
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

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}
