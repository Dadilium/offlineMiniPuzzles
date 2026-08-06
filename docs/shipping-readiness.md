# Shipping readiness audit — 2026-08-06

Refreshed from the 2026-07-31 snapshot. Revisit again before actually submitting.

## Blockers (will break a build)
- ~~No `assets/` directory at all.~~ **Done.** `assets/icon.png` exists (1024×1024, no alpha — meets Apple spec).
- ~~No `eas.json`.~~ **Done.** Build profiles (`development`/`preview`/`production`) configured.
- ~~Android adaptive icon missing~~ **Done.** `assets/adaptive-icon-foreground.png` generated (icon centered on a transparent 1024×1024 canvas, safe-zone padded) + `android.adaptiveIcon.backgroundColor` set to `#0f131d` (sampled from the icon's own background so it's seamless under any launcher mask shape).
- ~~Splash asset~~ **Done (verified after a real bug).** `expo-splash-screen` installed; native splash shows the app icon (`assets/adaptive-icon-foreground.png`, contain-fit) on `#0f131d`. JS-side, splash is held open via `preventAutoHideAsync`/`hideAsync` (`src/startup/bootstrap.ts`) until ad consent + Mobile Ads SDK init settle and a 2s minimum has elapsed, so it never flashes instantly. Sentry/PostHog aren't part of the gate — both init synchronously at module load, before the splash even renders.
  - **Bug found 2026-08-06 while visually verifying:** the first implementation configured `expo-splash-screen` as a plugin *tuple* with inline props (`["expo-splash-screen", {image, backgroundColor, ...}]`). `expo-splash-screen@0.27.7` (pinned for Expo SDK 51) predates that API — its `withSplashScreen` function takes only `config`, no `props`, so the entire object was silently discarded and it fell back to its own defaults (white background, no image). Every build looked like a plain white flash, on both a dev client and a release-style build — nothing wrong with the gating logic, the native asset itself was never generated with our icon. Confirmed by inspecting the built `.app`'s `Assets.car` (`SplashScreenBackground` was a 1×1 white placeholder) and the plugin source itself (`getIosSplashConfig`/`getAndroidSplashConfig` only read the legacy top-level `expo.splash` key).
  - **Fix:** moved the config back to the legacy top-level `"splash"` key in `app.json` (the only shape this version actually reads, for both iOS and Android), and reduced the `plugins` entry to a bare `"expo-splash-screen"` string. Verified locally via `expo prebuild` that `SplashScreen.imageset/image.png` now contains the real 1024×1024 icon and `SplashScreenBackground.imageset` is a 1×1 pixel of `#0f131d` (not the default white). **Visually confirmed** on an EAS `preview` build (simulator): icon on the dark background, held steady across the full gate.
  - **Lesson for the Expo SDK upgrade below:** later `expo-splash-screen` versions likely *do* support props-in-plugins — re-check the correct config shape when upgrading, don't assume the current setup transfers as-is.

## Blockers (will break a build) — continued
- **`SENTRY_AUTH_TOKEN` missing from all three EAS environments** (`development`/`preview`/`production` only have `POSTHOG_HOST`/`POSTHOG_PROJECT_TOKEN` — checked via `eas env:list`). Discovered 2026-08-06: any release-type (non-dev-client) cloud build fails during the Xcode archive step because the Sentry build phase runs `sentry-cli` to upload source maps and there's no auth token available. Worked around on the `preview` profile only by setting `SENTRY_ALLOW_FAILURE=true` in `eas.json` (`build.preview.env`) so the build doesn't hard-fail — but that just skips the upload silently, meaning **preview build crash reports won't be symbolicated in Sentry**. **Action:** add a real `SENTRY_AUTH_TOKEN` via `eas env:create` to all three environments, then remove the `SENTRY_ALLOW_FAILURE` escape hatch from `preview`. `production` doesn't have this escape hatch yet, so it will hit this same failure the first time it's actually built — fix before then.

## Needed for store submission (Apple + Google both require)
- ~~Privacy policy URL~~ **Done.** Live at the URL linked from Settings (verified reachable).
- ~~Settings screen~~ **Done.**
- ~~Crash/analytics telemetry~~ **Done.** Sentry + PostHog wired.
- ~~Monetization~~ **Done.** AdMob integrated: real prod ad unit IDs, UMP consent (GDPR/CCPA) → ATT → SDK init, interstitial cadence + rewarded skip.
- **`eas.json` `submit.production` is empty** — no Apple ID/ASC app ID/team ID or Android service account configured. `eas submit` won't work until this is filled in (manual upload is a fallback for the first release).
- **EAS build credentials** — signing cert/provisioning profile (iOS) and Play signing key (Android) need to be set up via `eas credentials` if not already done.
- **Store listing assets** — screenshots per device size, description, keywords, support URL, category. Not started; lives in App Store Connect / Play Console, not this repo.
- **Age rating / content questionnaire** — matters here since the app shows ads and uses ATT/AdMob (COPPA-adjacent questions on both stores).
- **Apple Privacy "nutrition label" + Google Play Data Safety form** — declare what AdMob/Sentry/PostHog collect.

## Should decide before launch
- **`expo-updates` (EAS Update/OTA) — deliberately skipped for now.** No update pipeline installed; the splash gate only waits on ad consent/SDK init + the 2s floor, nothing network-bound. Revisit once OTA is wanted — it'll need its own gating decision (block splash on a fetch vs. background-download-apply-next-launch, per the earlier discussion) rather than folding it into the current bootstrap blindly.
- **Expo SDK upgrade (currently pinned to `~51.0.0`, mid-2024).** Discovered 2026-08-06 while trying a local iOS build on this machine's Xcode 26.4: SDK-51-era native deps no longer compile clean against a current Xcode/iOS SDK —
  - `expo-localization@15.0.3` — non-exhaustive `switch` over `Calendar.Identifier` (new SDK added cases like Bangla/Gujarati/Tamil calendars). Patched via `patch-package` (`patches/expo-localization+15.0.3.patch`) to add the `@unknown default` case, mirroring the fix Expo shipped upstream in later SDK versions.
  - `expo-dev-menu@5.0.23` — `TARGET_IPHONE_SIMULATOR` no longer resolves in Swift under the newer toolchain (`DevMenuViewController.swift:66`). Not patched — worked around by building on EAS's `macos-sonoma-14.6-xcode-16.0` image instead, which matches the SDK these packages were built for.
  - Working around this package-by-package with local Xcode 26 isn't sustainable — there may be more of these, and each needs its own patch tracked indefinitely. The EAS cloud build profiles are pinned to Xcode 16.0, which avoids the problem for now, but Apple periodically raises the minimum SDK required for *new* App Store submissions, so this will eventually become a forced upgrade rather than an optional one.
  - **Action:** plan an Expo SDK upgrade (51 → current) as its own piece of work, not a quick patch. Until then, don't attempt local `expo run:ios`/`run:android` on a machine with a newer Xcode — use `eas build --profile development` for dev clients instead.

## Low-priority polish
- ~~README game list stale~~ **Done** — README now lists all 8 games.
- No web favicon — low priority for a mobile-first app.
- No test runner (deliberate, known deferral — not new).

## Looked solid at time of audit
- 8 games registered in `src/games/registry.ts`, each with engine/screens/tutorial/i18n (en+fr).
- Progress persistence via AsyncStorage per game (`useXProgress` hooks).
- Bundle identifiers set for both platforms (`com.antoineroy.puzzleden`).
