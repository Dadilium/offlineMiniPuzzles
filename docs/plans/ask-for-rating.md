# Ask for a Store Rating

**Status:** proposed
**Priority:** 4

## Why
`expo-store-review` isn't in the app. For a side project, ratings matter more than almost anything else for App Store ranking.

## Idea
- Ask only after a strong positive moment, e.g. the 3rd Hard-tier win, or a 7-day daily streak.
- Never after a failure, a skip, or right after an interstitial ad.
- Keep the trigger rules as a pure function (`shouldAskForReview(history) => boolean`) with a check script.
- Rate-limit locally (the OS also limits how often the prompt can appear).

## Notes
- New native dependency → EAS build + native-module guard pattern.
