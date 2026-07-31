# Add Sentry (crash/error reporting) + PostHog (product analytics)

## Context
App currently ships with zero visibility into crashes or usage. Decided pairing: **Sentry** for crash/error reporting, **PostHog** for product analytics (both event-priced, not user-priced — safer for a free game with unknown growth). User opted into a **dev client** (not Expo Go) so Sentry can capture native crashes, not just JS errors. Scope for this pass is MVP: app-level events + one game wired as a working example; rolling the same pattern into the other 7 games is a fast follow-up.

## Manual steps only you can do (accounts/interactive auth — I can't run these)
1. Create a Sentry project (React Native platform) → note **DSN**, **org slug**, **project slug**.
2. Create a PostHog project (US or EU cloud) → note **API key** and **host URL**.
3. `eas login`, then `eas build:configure` — creates `eas.json` and registers an EAS project ID in the app config. Currently there's no `eas.json` at all, so this is a first-time setup.
4. Later, run one `eas build --profile development --platform ios|android` to produce the dev client (~10-15 min, cloud, no Mac needed) and install it on your device/simulator.

I'll leave placeholders for the DSN/API key and wire everything to read from env vars, so dropping in real values after step 1-2 is a one-line `.env` edit.

## Implementation

1. **Install packages**
   `npx expo install @sentry/react-native expo-dev-client posthog-react-native dotenv`

2. **`app.json` → `app.config.js`** (needed to inject env vars via `extra`, and to add the Sentry config plugin)
   - Same JSON content, wrapped in a function; load `.env` via `dotenv` at the top.
   - `extra: { sentryDsn: process.env.SENTRY_DSN, posthogApiKey: process.env.POSTHOG_API_KEY, posthogHost: process.env.POSTHOG_HOST }`
   - Add plugin: `['@sentry/react-native/expo', { organization: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT }]` (existing `expo-localization` plugin stays).
   - Add `.env` to `.gitignore`; add a committed `.env.example` documenting the 5 keys.

3. **`src/utils/telemetry.ts`** — single isolated module wrapping both SDKs (keeps 3rd-party surface in one place, swappable later):
   - `initTelemetry()` — `Sentry.init({ dsn, enabled: !__DEV__, tracesSampleRate: 0.2 })` (disabled in dev/Expo-Go-style JS runs to avoid noisy duplicate events; active in dev client + production builds) and creates the PostHog client.
   - `trackEvent(name, properties?)` → `posthog.capture(...)`, no-ops if uninitialized.
   - `trackScreen(name)` → `posthog.screen(...)`.
   - `captureException(error, context?)` → `Sentry.captureException(...)`.
   - Export the PostHog client instance for the provider below.

4. **`src/hooks/useGameAnalytics.ts`** — thin reusable hook for any game:
   - `useGameAnalytics(gameId)` → `{ logGameStart(level), logGameWin(level, meta?), logGameFailed(level, meta?), logHintUsed(level) }`, each calling `trackEvent('game_started'|'game_completed'|'game_failed'|'hint_used', { game: gameId, level, ...meta })`.

5. **`src/components/ErrorBoundary.tsx`** — `Sentry.ErrorBoundary` with a themed fallback (uses `colors.ts`, matches dark UI) instead of a blank crash screen, small fade-in per the animation guideline.

6. **Wire into [App.tsx](App.tsx)**
   - Call `initTelemetry()` once at module scope.
   - Wrap the default export: `export default Sentry.wrap(App)`.
   - Wrap the tree in `<ErrorBoundary>` and in PostHog's `<PostHogProvider client={posthogClient}>`.
   - Add `onStateChange` to `NavigationContainer` → `trackScreen(currentRouteName)`.

7. **Example instrumentation — Color Sort** ([src/games/color-sort/screens/GameScreen.tsx](src/games/color-sort/screens/GameScreen.tsx)):
   - `const { logGameStart, logGameWin, logHintUsed } = useGameAnalytics('color-sort')`.
   - `logGameStart(levelIndex)` in the level-restart effect (~line 88-96).
   - `logGameWin(levelIndex)` in the win effect, next to `markLevelComplete` (~line 98-109).
   - `logHintUsed(levelIndex)` in the hint press handler.
   - This 3-line pattern is what gets copied into the remaining 7 games afterward (not in this pass).

## Verification
- `npm run typecheck` passes.
- Build + install the dev client (`eas build --profile development`), run `expo start --dev-client`.
- Play through Color Sort: confirm `screen`, `game_started`, `hint_used`, `game_completed` events land in PostHog's live events view.
- Temporarily throw an error in a button handler, confirm it lands in Sentry, then remove it.
- Confirm the app still boots cleanly with empty/missing env vars (telemetry no-ops rather than crashing).
