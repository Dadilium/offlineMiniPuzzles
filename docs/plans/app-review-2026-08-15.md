# App review — 2026-08-15

Full-app review across engineering architecture, game UX, and monetization/retention. Not a release-blocker audit (see `docs/shipping-readiness.md` for that) — this is about product/code quality once shipped.

## Status
- **#2 (per-game progress-hook duplication) — implemented 2026-08-15.** Extracted `createProgressStore` (`src/state/createProgressStore.ts`); all 8 games' `useXProgress` hooks now compose it instead of reimplementing AsyncStorage load/save/sanitize plumbing.
- **#3 (Find Words not wired into the hint wallet) — implemented 2026-08-15.** Find Words now spends/gates hints through `useHintGate` like every other game.
- Everything else below is unimplemented — prioritized, not yet acted on.

## Top 5

1. **Color Sort has no colorblind accommodation.** Tubes are colored purely via `backgroundColor` in `src/games/color-sort/components/ColorSortBoard.tsx` — no pattern/icon/label differentiates colors. For a game whose entire mechanic is "match by color," this can make specific palette pairs (cyan/teal, purple/pink) genuinely unsolvable for colorblind players, not just harder. Highest-risk finding in the whole review.
2. ~~**Per-game progress hooks had already diverged into a real bug.**~~ Done — see Status.
3. ~~**Find Words never wired into the shared hint wallet.**~~ Done — see Status.
4. **No retention hook beyond a flat daily +2 hints.** No streak counter, no escalating reward, no push-back-in mechanic (`expo-notifications` isn't installed), no rating prompt (`expo-store-review` isn't installed). Meanwhile PostHog feature flags are paid for and preloaded (`preloadFeatureFlags: true` in `src/config/posthog.ts`) but `isFeatureEnabled`/`getFeatureFlag` is never called anywhere, and ad cadence (`src/config/ads.ts`) is a hardcoded constant that could be flag-driven without a store release.
5. **The app-wide ErrorBoundary renders blank on any crash**, wrapping the entire `RootNavigator` in `App.tsx` with no per-screen recovery or "back to Library" affordance. A bug in one game's solver/generator takes down the whole app to a blank screen with force-quit as the only recourse — worse combined with zero test coverage on the riskiest code (solvers/generators).

## Quick, cheap wins
- **No `hitSlop` anywhere in the codebase.** Dense grids (Cross Sums, Shikaku) likely feel mis-tap-prone on small tap targets.
- **No `ad_watched`/rewarded-completion analytics event.** `useRewardedHint.ts`/`useRewardedSkip.ts`/`useInterstitialOnComplete.ts` have zero capture calls — no way to measure ad fill rate, completion rate, or rewarded-to-hint conversion from product data.
- **Dead `levels.ts` fixtures sitting inside live game folders** (`kings/levels.ts`, `matching-numbers/levels.ts`, 179+ lines each, confirmed unimported anywhere except their own module) — move to `tools/` or a `fixtures/` folder so the pattern isn't copy-pasted into a new game by mistake.
- **No `game_opened` event per `GameScreen.tsx` mount** — level completions are tracked, but not which games get opened-and-abandoned before finishing level 1.

## Worth knowing, lower urgency
- **6 of 8 games are grid-logic puzzles** (Shikaku, Kings, Cross Sums, Matching Numbers, Tents & Trees, Block Fill) — only Find Words and Color Sort break the mechanical shape. Worth leaning further from grid-fill for the next game rather than adding an 7th.
- **Win overlay (`src/components/WinOverlay.tsx`) is identical regardless of difficulty/time/hints used** — no run stats (time, moves, hints used), no sense of a hard level's win feeling bigger than an easy one. Confetti is a good touch but never varies.
- **Difficulty progression is more sophisticated than it looks to the player.** Shikaku/Block Fill/Matching Numbers/Kings share a skill-rating-driven procedural generator with a no-easy-fallback ladder (`generation/levelSource.ts` per game) — well-architected, but currently invisible in the UI. A subtle difficulty indicator could make progression feel earned.
- **Animation stack mixes RN's built-in `Animated` with `react-native-gesture-handler`'s drag system**, not Reanimated. Fine today (16 files use `Animated`, all reasonably driven with `useNativeDriver`), but Gesture Handler's natural pairing is Reanimated (worklets, UI-thread-driven) — worth deciding before more drag-heavy games/richer animations pile up rather than retrofitting later.
- **`src/i18n/index.ts` is a flat, hand-maintained registry** — already 16 explicit imports for 8 games × 2 languages, doubling every time a game or language is added. Not broken, but error-prone by hand at a 15-game/4-language scale; a codegen step or dynamic namespace loader would remove the "forgot to register a language" failure mode.
- **Test coverage is genuinely zero** (no jest config, no test script) — known, deliberate deferral, not news. Worth noting only because the existing per-game `__scripts__/engineSmoke.ts` / `sweep.ts` scripts (shikaku, color-sort, block-fill, find-words) are effectively hand-run smoke tests already and would port to real Jest specs with minimal rewrite whenever a runner lands.
