# Daily Puzzle

**Status:** implemented (2026-10-05), not yet verified on device
**Priority:** 1 (highest retention impact)

## Why
The app has a daily *gift* (`src/state/dailyReward.ts`) but no daily *puzzle*. One shared puzzle per game per day is the main habit loop in puzzle apps (NYT Games, Puzzle Baron). Every player gets the same board, with no server.

## Decisions
- **Generation:** all on-device, for all 9 games. Kings and Arrows run without their time limit for the daily (attempt count only), so the result can't depend on phone speed.
- **Difficulty:** weekday ramp, the same for everyone, ignoring the player's unlocked tier.
  - Mon/Tue = Easy, Wed/Thu = Medium, Fri/Sat = Hard, Sun = Expert.
- **Streaks:** one per game, plus an overall streak (at least one daily solved that day).
- **Hints:** allowed (rewarded), counted and shown on the share card. **Skip:** disabled.

## As built (differences from the plan below)
- Seeding: no per-game salt needed. Each game's existing robust generator gets `dailySeedIndex(day)` (day + 1,000,000) as its level index, so dailies never share a seed with regular levels. Only Kings needed a new generator (`createDailyLevel`, no time limit, re-seeds at the same tier only).
- Storage: each game has a second `createProgressStore` instance (`@signal-arcade/<game>/daily/v1`, via `toDailyStoreConfig`) for boards. Results (time, hints, solved) for all games live in one ledger (`@signal-arcade/daily/results/v1`, `DailyResultsProvider`); streaks are derived from it.
- No `DAILY_GEN_VERSION` and no 14-day pruning: boards persist once generated (so an OTA can't swap one mid-day) and are small enough to keep.
- Library chip → game hub with `{ startDaily: true }` → hub starts the daily (keeps tutorial gating in one place).
- Interstitials: a daily never opens with one, but its first solve counts toward the normal schedule -- an ad it makes due shows at the start of the next regular level. Banner and rewarded hints work as usual; in-level ad triggers (Arrows retry, Matching Numbers Add Numbers) stay off in daily.
- Measured on a Mac (`dailyDeterminism.check.ts`, 28 days): all 9 games deterministic, a different board each day; Kings Expert ≤ ~1 s, everything else < 100 ms.

## Core (pure, `src/daily/`)
- `dailyCalendar.ts`
  - `localDayKey(date) => 'YYYY-MM-DD'` (uses the player's local date, like `dailyReward.ts`).
  - `dayNumber(dayKey) => number`: days since a fixed launch epoch. Used as the puzzle number (#142) and the seed input.
  - `tierForDay(dayKey) => DifficultyTier`: the weekday ramp.
  - `dailyRating(tier) => number`: midpoint of `TIER_BANDS[tier]`, a fixed skill rating handed to the existing generators.
- `dailySeed.ts`: `dailySeed(gameId, dayNumber)`. Reuses `seedFromLevelIndex` with a per-game salt (hash of the id) and a `DAILY_SALT`, so daily boards never collide with normal level seeds.
- `streaks.ts`: `applyDailyResult(history, dayKey) => { streak, best }`. A gap of one or more days resets the streak. Handles both per-game and overall streaks.
- `shareText.ts`: `formatShare({ gameName, dayNumber, timeMs, hintsUsed, streak })`, e.g. `Kings #142 ✅ 2:31 💡1 🔥7`.
- `__scripts__/daily.check.ts`: day key and timezone edges, the weekday ramp, streak gaps, and the share format.
- `__scripts__/dailyDeterminism.check.ts`: generates the same day twice for each of the 9 games and asserts identical fingerprints. Also measures Kings and Arrows generation time at Expert.

## Determinism rules (each game's `generation/`)
- Add `createDailyLevel(dayNumber, tier)` to every `levelSource.ts`:
  - no `recentFingerprints` (that history differs per player)
  - no wall-clock deadline (Kings/Arrows get an attempt count only)
  - fallbacks stay at the same tier: re-seed with salt 1, 2, …, then the tier's `safeBoards`. Never step down a tier.
- Kings/Arrows: run the existing time-sliced async generator, so the UI never blocks.
- Bump a `DAILY_GEN_VERSION` whenever a generator changes. Once a board is generated, it is saved, so an OTA update mid-day never swaps the board under a player.

## State
- `src/daily/createDailyStore.ts`: a single shared store kept in AsyncStorage (`daily/v1`). Per game, per day: `{ level, solved, timeMs, hintsUsed }`, plus streak history.
  - It reuses each game's `isValidLevel`, `fingerprint` and `custom` board-state helpers, passed in through a new optional `GameModule.daily` entry.
  - Keeps only the last ~14 days of boards. Streak history is small and kept forever.
- Prefetch: at bootstrap and on app foreground, generate today's and tomorrow's daily for every game in the background. Kings/Arrows first, since they are the slowest.

## Game integration (×9)
- `GameModule.daily?: { createDailyLevel, isValidLevel, ... }` in `src/games/types.ts`.
- Each game's `GameScreen` route params become `{ levelIndex } | { dailyDay: string }`. Pick the daily store or the normal progress store by mode. Board logic stays the same.
- In daily mode:
  - hide the skip button
  - don't touch `skillRating` or tier unlocks
  - no interstitial at level start (avoid ads on the habit loop; to confirm)
  - the win overlay gets a **Share** button (RN `Share` API, no new native module)
- Start with Shikaku (synchronous, simple) as the reference implementation, then Kings (async, hardest), then the other 7.

## UI
- Library: a **Today** strip above the game grid, with one chip per game (solved ✓ / not yet) and the overall streak 🔥.
- Each game hub: a "Daily #142 · Hard" card above the level list, with that game's streak.
- Loading state: "Building today's puzzle…" with a subtle pulse, only if prefetch hasn't finished yet.
- Day rollover while the app is open: on foreground, re-read the day key and refresh the Today strip.
- i18n: EN + FR keys in `common` (strip, share, streak) and per game (the hub card).
- Analytics: `daily_started`, `daily_completed` (game_id, day_number, tier, time_ms, hints), `daily_shared`.

## Risks / open
- Expert Kings on a slow phone with no time limit: the background prefetch should hide this, but measure it with `dailyDeterminism.check.ts`. If the time is unacceptable, revisit pre-built boards for Kings only.
- Players on different app versions can get different boards if a generator changed. This is acceptable: the share card carries only the puzzle number.
- Interstitials in daily mode: confirm we skip them.

## Out of scope (later)
- Daily reminder notification, progress backup (`progress-backup.md`), leaderboards.
