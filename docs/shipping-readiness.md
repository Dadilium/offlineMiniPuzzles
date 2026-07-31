# Shipping readiness audit — 2026-07-31

Snapshot taken while scoping a first store release. Revisit before actually submitting, since state will have moved on (settings screen was in progress in a parallel session at the time of this audit).

## Blockers (will break a build)
- **No `assets/` directory at all.** `app.json` references `./assets/icon.png` and a splash config, but there is no assets folder or image file anywhere in the repo. `expo prebuild` / EAS build will fail on this. Needs an app icon, splash image, and Android adaptive-icon at minimum.
- **No `eas.json`.** `eas build:configure` hasn't been run yet, so there's no build profile to produce a store binary.

## Needed for store submission (Apple + Google both require)
- **Privacy policy URL** — mandatory at submission, and non-negotiable once analytics/crash reporting ships (see [plans/telemetry-sentry-posthog.md](plans/telemetry-sentry-posthog.md), not yet implemented).
- Store listing assets: screenshots per device size, description, keywords, age rating / content questionnaire.
- Settings screen — was being built in a parallel session as of this audit.

## Should decide before launch
- Monetization: none wired yet as of this audit (no ads/IAP dependency in `package.json`). [Now being scoped — see ads plan.]
- Crash/analytics visibility: shipping with zero telemetry means no signal on crashes or drop-off post-launch. Doesn't have to block v1, but should be a conscious call.

## Low-priority polish
- `README.md` game list is stale — missing Color Sort, Tents & Trees, and Shikaku.
- No test runner (deliberate, known deferral — not new).

## Looked solid at time of audit
- 8 games registered in `src/games/registry.ts`, each with engine/screens/tutorial/i18n (en+fr).
- Progress persistence via AsyncStorage per game (`useXProgress` hooks).
- Bundle identifiers already set for both platforms (`io.converge.signalarcade`).
