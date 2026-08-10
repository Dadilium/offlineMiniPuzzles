import { darkPalette } from '../../theme/palettes';
import type { GameModule } from '../types';
import KingsCardArt from './CardArt';
import HubScreen from './screens/HubScreen';
import LevelListScreen from './screens/LevelListScreen';
import TutorialScreen from './screens/TutorialScreen';
import GameScreen from './screens/GameScreen';
import { KingsProgressProvider, useKingsProgress } from './state/useKingsProgress';

// Single entry point the rest of the app needs to know about for Kings.
// Registered in src/games/registry.ts.
export const kingsGame: GameModule = {
  id: 'kings',
  status: 'ready',
  // A plain static object accessed outside React's render tree (e.g. from
  // registry.ts) can't call useTheme() -- accent hues are identical across
  // both palettes by design, so the dark value is theme-invariant here.
  accentColor: darkPalette.warn,
  CardArt: KingsCardArt,
  Provider: KingsProgressProvider,
  screens: [
    { name: 'KingsHub', component: HubScreen },
    { name: 'KingsLevels', component: LevelListScreen },
    { name: 'KingsTutorial', component: TutorialScreen },
    { name: 'KingsGame', component: GameScreen },
  ],
  entryScreen: 'KingsHub',
  useProgress: () => {
    const { levelsCompleted, resetAllProgress } = useKingsProgress();
    return { completed: levelsCompleted.size, reset: resetAllProgress };
  },
};
