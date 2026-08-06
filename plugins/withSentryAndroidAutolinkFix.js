const { withSettingsGradle } = require('@expo/config-plugins');

// On RN 0.74 (Expo SDK 51), android/settings.gradle runs both Expo's own
// autolinking (`useExpoModules()`) and the legacy RN CLI autolinking
// (`native_modules.gradle`). @sentry/react-native gets picked up by both,
// each sanitizing its Gradle project name differently ("sentry-react-native"
// vs "sentry_react-native") while pointing at the same android/ source dir,
// which trips Gradle's duplicate-output-directory validation and fails the
// build. Excluding it from Expo's pass leaves the legacy one as the only
// registration.
const TARGET = 'useExpoModules()';
const REPLACEMENT = "useExpoModules(exclude: ['@sentry/react-native'])";

module.exports = function withSentryAndroidAutolinkFix(config) {
  return withSettingsGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      return config;
    }
    if (config.modResults.contents.includes(TARGET)) {
      config.modResults.contents = config.modResults.contents.replace(TARGET, REPLACEMENT);
    }
    return config;
  });
};
