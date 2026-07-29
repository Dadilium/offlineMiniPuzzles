import { colors } from '../../theme/colors';
import type { GameModule } from '../types';
import HubScreen from './screens/HubScreen';
import LevelListScreen from './screens/LevelListScreen';
import TutorialScreen from './screens/TutorialScreen';
import GameScreen from './screens/GameScreen';
import { TentsAndTreesProgressProvider } from './state/useTentsAndTreesProgress';

// Single entry point the rest of the app needs to know about for Tents &
// Trees. Registered in src/games/registry.ts.
export const tentsAndTreesGame: GameModule = {
  id: 'tents-and-trees',
  name: 'Tents & Trees',
  tag: 'Match a tent to every tree',
  status: 'ready',
  accentColor: colors.pink,
  Provider: TentsAndTreesProgressProvider,
  screens: [
    { name: 'TentsAndTreesHub', component: HubScreen },
    { name: 'TentsAndTreesLevels', component: LevelListScreen },
    { name: 'TentsAndTreesTutorial', component: TutorialScreen },
    { name: 'TentsAndTreesGame', component: GameScreen },
  ],
  entryScreen: 'TentsAndTreesHub',
};
