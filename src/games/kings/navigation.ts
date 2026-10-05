import type { DailyOrigin } from '../../daily/navigation';

// This game's own slice of the root stack param list. Kept next to the game
// so the Kings folder is fully self-contained; RootNavigator just unions it in.
export type KingsStackParamList = {
  // startDaily: set by the Library's Today strip -- the hub starts today's
  // Daily Puzzle on arrival (through the tutorial if it hasn't been seen).
  KingsHub: { startDaily?: boolean } | undefined;
  KingsLevels: undefined;
  // pendingLevelIndex is null when the tutorial was opened from the hub's
  // "How to play" button (not gating entry to a specific level) -- finishing
  // it should return to the hub instead of starting a level.
  // pendingDaily: the pending level is a Daily Puzzle (pendingLevelIndex is its day number).
  KingsTutorial: { tutorialKey: string; pendingLevelIndex: number | null; pendingDaily?: DailyOrigin };
  // daily: this is a Daily Puzzle and levelIndex is its day number.
  KingsGame: { levelIndex: number; daily?: DailyOrigin };
};
