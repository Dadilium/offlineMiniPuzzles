import { colors } from '../../theme/colors';
import type { GameModule } from '../types';
import BlockFillCardArt from './CardArt';
import HubScreen from './screens/HubScreen';
import LevelListScreen from './screens/LevelListScreen';
import TutorialScreen from './screens/TutorialScreen';
import GameScreen from './screens/GameScreen';
import { BlockFillProgressProvider, useBlockFillProgress } from './state/useBlockFillProgress';

// Single entry point the rest of the app needs to know about for Block Fill.
// Registered in src/games/registry.ts.
export const blockFillGame: GameModule = {
  id: 'block-fill',
  status: 'ready',
  accentColor: colors.signalBlue,
  CardArt: BlockFillCardArt,
  Provider: BlockFillProgressProvider,
  screens: [
    { name: 'BlockFillHub', component: HubScreen },
    { name: 'BlockFillLevels', component: LevelListScreen },
    { name: 'BlockFillTutorial', component: TutorialScreen },
    { name: 'BlockFillGame', component: GameScreen },
  ],
  entryScreen: 'BlockFillHub',
  useProgress: () => {
    const { levelsCompleted, resetAllProgress } = useBlockFillProgress();
    return { completed: levelsCompleted.size, reset: resetAllProgress };
  },
};
