import { darkPalette } from '../../theme/palettes';
import type { GameModule } from '../types';
import FindWordsCardArt from './CardArt';
import HubScreen from './screens/HubScreen';
import LevelListScreen from './screens/LevelListScreen';
import TutorialScreen from './screens/TutorialScreen';
import GameScreen from './screens/GameScreen';
import { FindWordsProgressProvider, useFindWordsProgress } from './state/useFindWordsProgress';

// Single entry point the rest of the app needs to know about for Find
// Words. Registered in src/games/registry.ts.
export const findWordsGame: GameModule = {
  id: 'find-words',
  status: 'ready',
  // A plain static object accessed outside React's render tree (e.g. from
  // registry.ts) can't call useTheme() -- accent hues are identical across
  // both palettes by design, so the dark value is theme-invariant here.
  accentColor: darkPalette.teal,
  isNew: true,
  CardArt: FindWordsCardArt,
  Provider: FindWordsProgressProvider,
  screens: [
    { name: 'FindWordsHub', component: HubScreen },
    { name: 'FindWordsLevels', component: LevelListScreen },
    { name: 'FindWordsTutorial', component: TutorialScreen },
    // Swipe-back disabled: the whole board is a drag-to-select surface, and
    // starting a drag near the left edge would otherwise fight the native
    // stack's edge-swipe gesture. Back is still reachable via TopBar's chevron.
    { name: 'FindWordsGame', component: GameScreen, options: { gestureEnabled: false } },
  ],
  entryScreen: 'FindWordsHub',
  useProgress: () => {
    const { levelsCompleted, resetAllProgress } = useFindWordsProgress();
    return { completed: levelsCompleted.size, reset: resetAllProgress };
  },
};
