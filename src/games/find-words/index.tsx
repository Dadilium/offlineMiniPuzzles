import { colors } from '../../theme/colors';
import type { GameModule } from '../types';
import FindWordsCardArt from './CardArt';
import HubScreen from './screens/HubScreen';
import LevelListScreen from './screens/LevelListScreen';
import TutorialScreen from './screens/TutorialScreen';
import GameScreen from './screens/GameScreen';
import { FindWordsProgressProvider, useFindWordsProgress } from './state/useFindWordsProgress';

// Single entry point the rest of the app needs to know about for Find
// Words. Registered in src/games/registry.ts.
export const findWordsGame: GameModule = {
  id: 'find-words',
  status: 'ready',
  accentColor: colors.teal,
  CardArt: FindWordsCardArt,
  Provider: FindWordsProgressProvider,
  screens: [
    { name: 'FindWordsHub', component: HubScreen },
    { name: 'FindWordsLevels', component: LevelListScreen },
    { name: 'FindWordsTutorial', component: TutorialScreen },
    { name: 'FindWordsGame', component: GameScreen },
  ],
  entryScreen: 'FindWordsHub',
  useProgress: () => {
    const { levelsCompleted, resetAllProgress } = useFindWordsProgress();
    return { completed: levelsCompleted.size, reset: resetAllProgress };
  },
};
