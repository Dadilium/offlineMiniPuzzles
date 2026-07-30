import { colors } from '../../theme/colors';
import type { GameModule } from '../types';
import HubScreen from './screens/HubScreen';
import LevelListScreen from './screens/LevelListScreen';
import TutorialScreen from './screens/TutorialScreen';
import GameScreen from './screens/GameScreen';
import { KingsProgressProvider } from './state/useKingsProgress';

// Single entry point the rest of the app needs to know about for Kings.
// Registered in src/games/registry.ts.
export const kingsGame: GameModule = {
  id: 'kings',
  status: 'ready',
  accentColor: colors.warn,
  Provider: KingsProgressProvider,
  screens: [
    { name: 'KingsHub', component: HubScreen },
    { name: 'KingsLevels', component: LevelListScreen },
    { name: 'KingsTutorial', component: TutorialScreen },
    { name: 'KingsGame', component: GameScreen },
  ],
  entryScreen: 'KingsHub',
};
