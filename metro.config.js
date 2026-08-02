const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

// Off by default on this Metro version (RN 0.74) -- became default only in RN 0.79+.
// posthog-react-native needs it: it imports @posthog/core's subpath exports
// (e.g. "@posthog/core/surveys"), which only resolve through the exports map.
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
