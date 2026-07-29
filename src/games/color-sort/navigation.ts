// This game's own slice of the root stack param list. Kept next to the game
// so the Color Sort folder is fully self-contained; RootNavigator just unions it in.
export type ColorSortStackParamList = {
  ColorSortHub: undefined;
  ColorSortLevels: undefined;
  // pendingLevelIndex is null when the tutorial was opened from the hub's
  // "How to play" button (not gating entry to a specific level) -- finishing
  // it should return to the hub instead of starting a level.
  ColorSortTutorial: { tutorialKey: string; pendingLevelIndex: number | null };
  ColorSortGame: { levelIndex: number };
};
