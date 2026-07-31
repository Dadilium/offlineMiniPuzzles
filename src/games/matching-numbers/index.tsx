import { colors } from '../../theme/colors';
import type { GameModule } from '../types';
import MatchingNumbersCardArt from './CardArt';
import HubScreen from './screens/HubScreen';
import LevelListScreen from './screens/LevelListScreen';
import TutorialScreen from './screens/TutorialScreen';
import GameScreen from './screens/GameScreen';
import { MatchingNumbersProgressProvider, useMatchingNumbersProgress } from './state/useMatchingNumbersProgress';

// Single entry point the rest of the app needs to know about for Matching
// Numbers. Registered in src/games/registry.ts.
export const matchingNumbersGame: GameModule = {
  id: 'matching-numbers',
  status: 'ready',
  accentColor: colors.purple,
  CardArt: MatchingNumbersCardArt,
  Provider: MatchingNumbersProgressProvider,
  screens: [
    { name: 'MatchingNumbersHub', component: HubScreen },
    { name: 'MatchingNumbersLevels', component: LevelListScreen },
    { name: 'MatchingNumbersTutorial', component: TutorialScreen },
    { name: 'MatchingNumbersGame', component: GameScreen },
  ],
  entryScreen: 'MatchingNumbersHub',
  useProgress: () => {
    const { levelsCompleted, resetAllProgress } = useMatchingNumbersProgress();
    return { completed: levelsCompleted.size, reset: resetAllProgress };
  },
};
