const { withProjectBuildGradle } = require('expo/config-plugins');

// Google Play Services artifacts (pulled in transitively by
// react-native-google-mobile-ads) ship Kotlin metadata ahead of the Kotlin
// version React Native's Gradle plugin bundles by default, so the compiler
// refuses to read them ("Module was compiled with an incompatible version of
// Kotlin"). Forcing a project-wide Kotlin version bump via
// expo-build-properties doesn't reliably apply to every autolinked module
// (expo/expo#22464) and creates a worse partial-upgrade state, so instead we
// tell every module's Kotlin compiler to skip that check -- safe here since
// nothing in this app touches the newer-Kotlin-only APIs directly, we're
// just reading precompiled Java-interop-shaped classes from those AARs.
const SNIPPET = `
subprojects {
  tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
    compilerOptions.freeCompilerArgs.addAll(["-Xskip-metadata-version-check"])
  }
}
`;

module.exports = function withKotlinSkipMetadataVersionCheck(config) {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      return config;
    }
    if (!config.modResults.contents.includes('-Xskip-metadata-version-check')) {
      config.modResults.contents += SNIPPET;
    }
    return config;
  });
};
