// `accentColor` lives outside the React tree (a static registry entry), so
// it's sourced straight from the palette -- indigo is identical in light and
// dark, same as every other game's fixed accent.
import { darkPalette } from '../../theme/palettes';
import type { GameModule } from '../types';
import ArrowsCardArt from './CardArt';
import HubScreen from './screens/HubScreen';
import LevelListScreen from './screens/LevelListScreen';
import TutorialScreen from './screens/TutorialScreen';
import GameScreen from './screens/GameScreen';
import { ArrowsProgressProvider, useArrowsProgress } from './state/useArrowsProgress';

// Single entry point the rest of the app needs to know about for Arrows.
// Registered in src/games/registry.ts.
export const arrowsGame: GameModule = {
  id: 'arrows',
  status: 'ready',
  accentColor: darkPalette.indigo,
  isNew: true,
  CardArt: ArrowsCardArt,
  Provider: ArrowsProgressProvider,
  screens: [
    { name: 'ArrowsHub', component: HubScreen },
    { name: 'ArrowsLevels', component: LevelListScreen },
    { name: 'ArrowsTutorial', component: TutorialScreen },
    // Swipe-back disabled: the board is a pinch/pan surface, and a pan
    // starting near the left edge would otherwise fight the native stack's
    // edge-swipe. Back stays reachable via TopBar's chevron.
    { name: 'ArrowsGame', component: GameScreen, options: { gestureEnabled: false } },
  ],
  entryScreen: 'ArrowsHub',
  supportsDaily: true,
  useProgress: () => {
    const { levelsCompleted, resetAllProgress } = useArrowsProgress();
    return { completed: levelsCompleted.size, reset: resetAllProgress };
  },
};
