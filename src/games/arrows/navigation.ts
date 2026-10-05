import type { DailyOrigin } from '../../daily/navigation';

// This game's own slice of the root stack param list. Kept next to the game
// so the Arrows folder is fully self-contained; RootNavigator just unions it in.
export type ArrowsStackParamList = {
  // startDaily: set by the Library's Today strip -- the hub starts today's
  // Daily Puzzle on arrival (through the tutorial if it hasn't been seen).
  ArrowsHub: { startDaily?: boolean } | undefined;
  ArrowsLevels: undefined;
  // pendingLevelIndex is null when the tutorial was opened from the hub's
  // "How to play" button -- finishing it returns to the hub instead.
  // pendingDaily: the pending level is a Daily Puzzle (pendingLevelIndex is its day number).
  ArrowsTutorial: { tutorialKey: string; pendingLevelIndex: number | null; pendingDaily?: DailyOrigin };
  // daily: this is a Daily Puzzle and levelIndex is its day number.
  ArrowsGame: { levelIndex: number; daily?: DailyOrigin };
};
