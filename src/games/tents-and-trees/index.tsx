import { colors } from '../../theme/colors';
import type { GameModule } from '../types';
import TentsAndTreesCardArt from './CardArt';
import HubScreen from './screens/HubScreen';
import LevelListScreen from './screens/LevelListScreen';
import TutorialScreen from './screens/TutorialScreen';
import GameScreen from './screens/GameScreen';
import { TentsAndTreesProgressProvider, useTentsAndTreesProgress } from './state/useTentsAndTreesProgress';

// Single entry point the rest of the app needs to know about for Tents &
// Trees. Registered in src/games/registry.ts.
export const tentsAndTreesGame: GameModule = {
  id: 'tents-and-trees',
  status: 'ready',
  accentColor: colors.pink,
  CardArt: TentsAndTreesCardArt,
  Provider: TentsAndTreesProgressProvider,
  screens: [
    { name: 'TentsAndTreesHub', component: HubScreen },
    { name: 'TentsAndTreesLevels', component: LevelListScreen },
    { name: 'TentsAndTreesTutorial', component: TutorialScreen },
    { name: 'TentsAndTreesGame', component: GameScreen },
  ],
  entryScreen: 'TentsAndTreesHub',
  useProgress: () => {
    const { levelsCompleted, resetAllProgress } = useTentsAndTreesProgress();
    return { completed: levelsCompleted.size, reset: resetAllProgress };
  },
};
