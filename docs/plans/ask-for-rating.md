# Ask for a Store Rating

**Status:** implemented 2026-10-05; the in-app ask needs the next EAS build (`expo-store-review` is native), not yet verified on device
**Priority:** 4

## Why
For a side project, ratings matter more than almost anything else for store ranking.

## Design
- **When it's owed** (pure rules, `src/review/reviewRules.ts`):
  - a clean win (no hints) at Hard or Expert, on the 3rd / 15th / 40th one, from any game, regular or daily;
  - the overall daily streak reaching 7 / 30 / 100 days.
- **When it's shown:** on the next win screen, 1.5 s after it appears (after the confetti), through the OS's own review sheet (`expo-store-review`). Leaving the win screen before then keeps it owed.
- **Never** after a failure, a skip or an ad: those produce no event. Interstitials only show at level start, never on the win screen.
- **Throttles** on top of the OS's own:
  - nothing in the first 2 days after install;
  - 120 days between asks;
  - 3 asks lifetime.
  - A milestone hit during a cooldown is dropped rather than surfacing months later.
- **Settings → "Rate Puzzle Den":** opens the store's write-a-review page directly.
  - iOS: `apps.apple.com/app/id6802090640?action=write-review`.
  - Android: Play Store app, with the web listing as fallback.
  - Plain links, no native module, so the row works today via OTA.

## Files
- `src/review/reviewRules.ts`: pure rules, checked by `__scripts__/reviewRules.check.ts`.
- `src/review/ReviewProvider.tsx`: state (`@signal-arcade/review/v1`), event wiring, guarded `require('expo-store-review')`, store links.
- `src/state/levelEvents.ts`: app-wide first-clear signal, emitted by `createProgressStore` (regular levels) and `useDailySession` (dailies, with the day's tier).
- `src/components/WinOverlay.tsx`: calls `presentIfOwed` once visible.
- `src/config/links.ts`: store ids and URLs.

## Analytics
`review_owed { trigger }`, `review_requested`, `review_settings_opened`.

## Notes
- The OS gives no signal whether its sheet actually appeared (iOS shows it at most 3× / 365 days, and never in TestFlight). A request counts as an ask either way.
- To test the sheet on iOS, use a development build (it always shows there). Android shows it only for builds installed from the Play Store (internal testing track works).
