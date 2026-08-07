# Ads monetization plan

## Status
Interstitial + rewarded skip shipped first (see `docs/shipping-readiness.md`). The hint wallet + daily reward described below was implemented on 2026-08-07, with a few deviations from the original spec:
- Daily reward is **+2**, not +1.
- The daily claim is surfaced via an `Alert` on the Library screen (`src/screens/LibraryScreen.tsx`), not silently applied.
- Each game's Hint button shows the wallet balance in its own label (`Hint (3)`), not just a video-icon swap at 0.
- Real file paths: `src/state/hintWallet.ts` (provider + `useHintWallet`), `src/ads/useRewardedHint.ts`, `src/ads/useHintGate.ts` (the per-game gate: spend-or-watch-ad, then refund/grant if the game's own hint logic reports nothing was actually revealed) — under `src/ads/`, not the `src/services/ads/` path this doc originally proposed, matching where `useRewardedSkip`/`useInterstitialOnComplete` actually live.
- Reuses the single existing `rewarded` ad unit (`adUnitIds.rewarded`) rather than a separate `rewarded_hint` unit — only one rewarded unit was ever actually created.
- Relay is included in the hint wallet (its Hint button now draws from the same global balance) even though it's excluded from the interstitial/skip `GameId` economy — the wallet has no such dependency.

## Context
First monetization pass: rewarded ads for hints/skip (opt-in, never blocks solving) plus a periodic interstitial to monetize skilled players who rarely need hints. Landed on this shape after discussion:
- Interstitial trigger is **level-completion count**, not "return to Library" — power users chain levels via the level list/hub and rarely revisit Library mid-session, so a Library-based trigger would miss the exact segment (fast players, many levels/session, never need hints) it's meant to monetize.
- It fires on the **level-complete → next-level transition**, which every game already pauses on for the win celebration — not a mid-solve interruption.
- A cooldown protects players who complete levels in seconds (explicitly raised: ~10s/level on Kings) from getting stacked ads back to back.
- Needs a real ad SDK → native module → reinforces the dev-client decision already made for Sentry ([telemetry-sentry-posthog.md](telemetry-sentry-posthog.md)); same EAS dev-client build can cover both.

## Manual prerequisites (accounts — only you can do these)
1. Create an AdMob account, register iOS + Android apps, create 3 ad units: `rewarded_hint`, `rewarded_skip`, `interstitial`. Note the App IDs + unit IDs.
2. Same `eas login` / dev-client build as the telemetry plan — do both native SDKs (Sentry + AdMob) in one dev-client build rather than two.

## Mechanics (locked in)
- **Hint**: global wallet (one balance across all 8 games, not per-game — simpler state, one system). Spend 1 to use a hint. At 0, the hint button switches to a video-icon state; tapping shows a rewarded ad, and only on ad-watched-to-completion does the existing per-game hint logic run.
- **Daily free hint**: +1 to the wallet on first app open of a new calendar day (local midnight reset — simplest mental model, matches typical daily-reward UX elsewhere).
- **Skip**: always requires watching a rewarded ad to completion; declining/closing early does not skip.
- **Interstitial**: every 4-5 level completions (tune via one constant), triggered on the win-overlay's "Next" tap. Skipped entirely during a first-session grace period (first ~5 lifetime level completions), and rate-limited to at most one per ~2-3 min regardless of completion count, so a fast player doesn't get stacked ads.
- **Future-proofing**: every ad-gate checks a single `hasRemovedAds` boolean (defaults false, unused until an IAP is built) so a future "remove ads" purchase is a one-line integration, not a rework.

## Compliance (non-optional the moment an ad SDK ships)
- Google UMP consent flow (GDPR/UK) — required in EEA/UK regardless of whether ads are personalized.
- iOS App Tracking Transparency prompt — required before any ad request that could use IDFA.
- Both must resolve before the Mobile Ads SDK initializes.

## Implementation

1. **SDK**: `npx expo install react-native-google-mobile-ads expo-tracking-transparency` — official, actively maintained AdMob SDK; ships its own Expo config plugin (auto-injects AdMob App ID + SKAdNetwork IDs).

2. **`app.config.js`** (same conversion as the telemetry plan — do once, serves both):
   - Add plugin: `['react-native-google-mobile-ads', { androidAppId: process.env.ADMOB_ANDROID_APP_ID, iosAppId: process.env.ADMOB_IOS_APP_ID }]`.
   - `ios.infoPlist.NSUserTrackingUsageDescription` for the ATT prompt.
   - `.env` additions: `ADMOB_ANDROID_APP_ID`, `ADMOB_IOS_APP_ID`, `ADMOB_REWARDED_HINT_UNIT_ID`, `ADMOB_REWARDED_SKIP_UNIT_ID`, `ADMOB_INTERSTITIAL_UNIT_ID`.

3. **`src/services/ads/adUnits.ts`** — resolves real vs. AdMob's official test unit IDs by `__DEV__`, so dev builds never serve/click real ads.

4. **`src/services/ads/consent.ts`** — `initAds()`: runs UMP consent flow, then `requestTrackingPermissionsAsync()` on iOS, then initializes the Mobile Ads SDK. Called once from [App.tsx](../../App.tsx), alongside `initTelemetry()`.

5. **`src/state/hintWallet.ts`** — AsyncStorage-backed, same pattern as existing `useXProgress` hooks (e.g. `src/games/color-sort/state/useColorSortProgress.ts`) but app-level: `{ balance, lastClaimDate }`, pure functions for spend/claim, exposed via a `useHintWallet()` hook. Claims the daily hint on mount if `lastClaimDate` isn't today.

6. **`src/services/ads/useRewardedAd.ts`** — generic hook: `useRewardedAd(unitId)` → `{ isReady, show(): Promise<boolean /* earned reward */> }`. Used for both hint-refill and skip.

7. **`src/services/ads/interstitialGate.ts`** — tracks lifetime level-completions, completions-since-last-interstitial, and last-shown timestamp (AsyncStorage + in-memory). Exposes `maybeShowInterstitial(): Promise<void>`, no-ops if `hasRemovedAds`, inside the grace period, under the completion threshold, or inside the cooldown window.

8. **`src/components/GameActionButton.tsx`** — add an optional `icon` prop so the Hint button can render a small video-ad icon when the wallet is empty (currently label-only, per [src/components/GameActionButton.tsx](../../src/components/GameActionButton.tsx)).

9. **`src/components/WinOverlay.tsx`** (+ the not-yet-migrated `src/games/relay/components/WinOverlay.tsx`) — wrap the `onNext` prop: call `maybeShowInterstitial()` first, then the game's real `onNext`. Single choke point since every game already routes "Next" through this component — no per-game changes needed for the interstitial specifically.

10. **Each game's `GameScreen.tsx`** (8 files, same 2-3 line pattern each — representative example: [src/games/color-sort/screens/GameScreen.tsx:207](../../src/games/color-sort/screens/GameScreen.tsx#L207)):
    - Hint button's `onPress`: `const granted = await requestHint(); if (!granted) return;` before the existing per-game hint logic (hint *logic* stays per-game — the solver-driven hint differs by puzzle type — only the gate is shared).
    - Skip button's `onPress`: `const watched = await showRewardedAd('skip'); if (!watched) return;` before the existing skip logic.

## Verification
- Using AdMob test unit IDs in the dev client: hint button shows normal state with balance > 0, switches to video-icon state at 0; tapping loads and shows a rewarded ad; only on completion does the balance/hint grant fire.
- Skip: closing the ad early does not skip the level; watching it to completion does.
- Rapid-play test (simulate the 10s/level case): confirm the interstitial fires around the 4th-5th completion, not before the first-session grace threshold, and not more than once per cooldown window even when completing levels back to back.
- Kill and relaunch the app the next calendar day (or fake `lastClaimDate`): confirm exactly one free hint is granted.
- Confirm UMP consent + ATT prompts appear before any ad request, and the app doesn't crash if consent is declined (ads simply don't load).
