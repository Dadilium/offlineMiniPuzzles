import { colors } from '../../theme/colors';
import type { GameModule } from '../types';
import ShikakuCardArt from './CardArt';
import HubScreen from './screens/HubScreen';
import LevelListScreen from './screens/LevelListScreen';
import TutorialScreen from './screens/TutorialScreen';
import GameScreen from './screens/GameScreen';
import { ShikakuProgressProvider, useShikakuProgress } from './state/useShikakuProgress';

// Single entry point the rest of the app needs to know about for Shikaku.
// Registered in src/games/registry.ts.
export const shikakuGame: GameModule = {
  id: 'shikaku',
  status: 'ready',
  accentColor: colors.signalRed,
  CardArt: ShikakuCardArt,
  Provider: ShikakuProgressProvider,
  screens: [
    { name: 'ShikakuHub', component: HubScreen },
    { name: 'ShikakuLevels', component: LevelListScreen },
    { name: 'ShikakuTutorial', component: TutorialScreen },
    { name: 'ShikakuGame', component: GameScreen },
  ],
  entryScreen: 'ShikakuHub',
  useProgress: () => {
    const { levelsCompleted, resetAllProgress } = useShikakuProgress();
    return { completed: levelsCompleted.size, reset: resetAllProgress };
  },
};
