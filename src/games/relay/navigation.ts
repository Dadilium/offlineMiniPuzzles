import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { levelTutorialKey } from './levels';
import type { RelayLevel } from './types';

// This game's own slice of the root stack param list. Kept next to the game
// so the Relay folder is fully self-contained; RootNavigator just unions it in.
export type RelayStackParamList = {
  RelayHub: undefined;
  RelayLevels: undefined;
  // pendingLevelIndex is null when the tutorial was opened from the hub's
  // "How to play" button (not gating entry to a specific level) -- finishing
  // it should return to the hub instead of starting a level.
  RelayTutorial: { tutorialKey: string; pendingLevelIndex: number | null };
  RelayGame: { levelIndex: number };
  // Dev-only: lists/plays levels from tools/level-creator/drafts/relay before
  // they've shipped via `npm run levels -- relay add`. Only reachable from a
  // __DEV__-gated hub button, but the routes themselves always register --
  // same pattern as every other screen in this stack.
  RelayDraftList: undefined;
  RelayDraftPlay: { level: RelayLevel };
};

/**
 * Single place that decides "does entering level `idx` need its gating
 * tutorial first, or straight into the game". Every entry point (hub,
 * level list, and the in-game "next level" flow) must go through this --
 * duplicating the check inline is how the mirrors tutorial ended up
 * skippable via the "next level" path.
 *
 * `gameNavMethod` controls how the no-tutorial-needed branch reaches
 * RelayGame: GameScreen's own "next level" wants `replace` (so the stack
 * doesn't grow with every level cleared, matching its pre-existing
 * behavior), while the hub/level list want the default `navigate`. The
 * tutorial branch always pushes via `navigate` -- TutorialScreen.finish()
 * itself replaces to RelayGame once it's done, same as everywhere else.
 */
export function enterLevel<RouteName extends keyof RelayStackParamList>(
  navigation: NativeStackNavigationProp<RelayStackParamList, RouteName>,
  idx: number,
  tutorialsSeen: Set<string>,
  gameNavMethod: 'navigate' | 'replace' = 'navigate'
) {
  const key = levelTutorialKey[idx];
  if (key && !tutorialsSeen.has(key)) {
    navigation.navigate('RelayTutorial', { tutorialKey: key, pendingLevelIndex: idx });
  } else if (gameNavMethod === 'replace') {
    navigation.replace('RelayGame', { levelIndex: idx });
  } else {
    navigation.navigate('RelayGame', { levelIndex: idx });
  }
}
