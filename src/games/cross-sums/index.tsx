import { colors } from '../../theme/colors';
import type { GameModule } from '../types';
import HubScreen from './screens/HubScreen';
import LevelListScreen from './screens/LevelListScreen';
import TutorialScreen from './screens/TutorialScreen';
import GameScreen from './screens/GameScreen';
import { CrossSumsProgressProvider } from './state/useCrossSumsProgress';

// Single entry point the rest of the app needs to know about for Cross Sums.
// Registered in src/games/registry.ts.
export const crossSumsGame: GameModule = {
  id: 'cross-sums',
  status: 'ready',
  accentColor: colors.success,
  Provider: CrossSumsProgressProvider,
  screens: [
    { name: 'CrossSumsHub', component: HubScreen },
    { name: 'CrossSumsLevels', component: LevelListScreen },
    { name: 'CrossSumsTutorial', component: TutorialScreen },
    { name: 'CrossSumsGame', component: GameScreen },
  ],
  entryScreen: 'CrossSumsHub',
};
