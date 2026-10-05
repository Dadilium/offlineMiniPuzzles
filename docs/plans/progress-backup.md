# Back Up Progress

**Status:** proposed
**Priority:** 5 (becomes more important once daily streaks exist)

## Why
All progress lives in AsyncStorage, so a new phone means starting over. Losing a long streak is a strong reason to quit the app.

## Idea
- iOS: iCloud key-value storage for progress, streaks and the hint wallet.
- Android: Auto Backup rules covering the AsyncStorage data.
- Merge rule when restoring: take the max per level / per streak, never overwrite newer data with older data. Keep it a pure function with a check script.

## Notes
- New native dependency / config → EAS build + native-module guard pattern.
- Ship after the daily puzzle so there are streaks worth protecting.
