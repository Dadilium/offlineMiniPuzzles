import { colors } from '../../theme/colors';
import type { GameModule } from '../types';
import HubScreen from './screens/HubScreen';
import LevelListScreen from './screens/LevelListScreen';
import TutorialScreen from './screens/TutorialScreen';
import GameScreen from './screens/GameScreen';
import { ColorSortProgressProvider } from './state/useColorSortProgress';

// Single entry point the rest of the app needs to know about for Color Sort.
// Registered in src/games/registry.ts.
export const colorSortGame: GameModule = {
  id: 'color-sort',
  status: 'ready',
  accentColor: colors.cyan,
  Provider: ColorSortProgressProvider,
  screens: [
    { name: 'ColorSortHub', component: HubScreen },
    { name: 'ColorSortLevels', component: LevelListScreen },
    { name: 'ColorSortTutorial', component: TutorialScreen },
    { name: 'ColorSortGame', component: GameScreen },
  ],
  entryScreen: 'ColorSortHub',
};
