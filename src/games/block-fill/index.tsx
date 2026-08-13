import { darkPalette } from '../../theme/palettes';
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
  // Registered at module scope outside any component (consumed directly by
  // the Library screen's registry), so it can't reach useTheme(). Signal
  // colors are identical across both palettes (see theme/palettes.ts), so
  // pulling straight from one palette is safe here.
  accentColor: darkPalette.signalBlue,
  CardArt: BlockFillCardArt,
  Provider: BlockFillProgressProvider,
  screens: [
    { name: 'BlockFillHub', component: HubScreen },
    { name: 'BlockFillLevels', component: LevelListScreen },
    { name: 'BlockFillTutorial', component: TutorialScreen },
    // Swipe-back disabled: the whole board is a drag-to-fill surface, and
    // starting a drag near the left edge would otherwise fight the native
    // stack's edge-swipe gesture. Back is still reachable via TopBar's chevron.
    { name: 'BlockFillGame', component: GameScreen, options: { gestureEnabled: false } },
  ],
  entryScreen: 'BlockFillHub',
  useProgress: () => {
    const { levelsCompleted, resetAllProgress } = useBlockFillProgress();
    return { completed: levelsCompleted.size, reset: resetAllProgress };
  },
};
