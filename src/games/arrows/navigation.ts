// This game's own slice of the root stack param list. Kept next to the game
// so the Arrows folder is fully self-contained; RootNavigator just unions it in.
export type ArrowsStackParamList = {
  ArrowsHub: undefined;
  ArrowsLevels: undefined;
  // pendingLevelIndex is null when the tutorial was opened from the hub's
  // "How to play" button -- finishing it returns to the hub instead.
  ArrowsTutorial: { tutorialKey: string; pendingLevelIndex: number | null };
  ArrowsGame: { levelIndex: number };
};
