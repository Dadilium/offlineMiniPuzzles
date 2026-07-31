import { colors } from '../../theme/colors';
import type { GameModule } from '../types';
import ColorSortCardArt from './CardArt';
import HubScreen from './screens/HubScreen';
import LevelListScreen from './screens/LevelListScreen';
import TutorialScreen from './screens/TutorialScreen';
import GameScreen from './screens/GameScreen';
import { ColorSortProgressProvider, useColorSortProgress } from './state/useColorSortProgress';

// Single entry point the rest of the app needs to know about for Color Sort.
// Registered in src/games/registry.ts.
export const colorSortGame: GameModule = {
  id: 'color-sort',
  status: 'ready',
  accentColor: colors.cyan,
  CardArt: ColorSortCardArt,
  Provider: ColorSortProgressProvider,
  screens: [
    { name: 'ColorSortHub', component: HubScreen },
    { name: 'ColorSortLevels', component: LevelListScreen },
    { name: 'ColorSortTutorial', component: TutorialScreen },
    { name: 'ColorSortGame', component: GameScreen },
  ],
  entryScreen: 'ColorSortHub',
  useProgress: () => {
    const { levelsCompleted, resetAllProgress } = useColorSortProgress();
    return { completed: levelsCompleted.size, reset: resetAllProgress };
  },
};
