# Back Up Progress

**Status:** implemented 2026-10-06 (needs the next EAS build)
**Priority:** 5

## Why
All progress lives in AsyncStorage, so a new phone means starting over. Losing a long streak is a strong reason to quit the app.

## What shipped
Manual backup file, in Settings > Game Progress (works across iOS and Android, no server):
- **Save backup**: writes `puzzle-den-backup-YYYY-MM-DD.json` and opens the share sheet (Files / iCloud Drive, Google Drive, email...).
- **Restore**: document picker -> validate -> confirm dialog with a summary -> merge -> app restarts so every provider reloads.

Code: `src/backup/backupFormat.ts` (keys, file format, summary) and `backupMerge.ts` (merge rule) are pure,
checked by `__scripts__/backup.check.ts`. `backupIO.ts` holds the native parts behind the guard pattern.

Merge rule, never trades newer progress for older:
- Game progress / daily boards: the side with more levels done wins as a whole; a tie keeps the device.
- Daily results: merged per day (solved beats unsolved), so streaks from both sides survive.
- Hint wallet: backup wins only on a fresh install or if its last daily claim is more recent.
- Settings: restored only where missing. Ads, rating-ask and reminder state never leave the device.

## Possible follow-up
- Automatic backup (iCloud key-value storage / Android Auto Backup) on top of the manual file.
