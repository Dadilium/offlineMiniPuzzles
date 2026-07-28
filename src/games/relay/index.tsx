import type { GameModule } from '../types';
import DraftListScreen from './screens/DraftListScreen';
import DraftPlayScreen from './screens/DraftPlayScreen';
import HubScreen from './screens/HubScreen';
import LevelListScreen from './screens/LevelListScreen';
import TutorialScreen from './screens/TutorialScreen';
import GameScreen from './screens/GameScreen';
import { RelayProgressProvider } from './state/useRelayProgress';

// This is the single entry point the rest of the app needs to know about
// for the Relay game. Adding a new game later = create src/games/<id>/index.tsx
// exporting the same shape, then register it in src/games/registry.ts.
export const relayGame: GameModule = {
  id: 'relay',
  name: 'Relay',
  tag: 'Signal-routing puzzle',
  status: 'ready',
  Provider: RelayProgressProvider,
  screens: [
    { name: 'RelayHub', component: HubScreen },
    { name: 'RelayLevels', component: LevelListScreen },
    { name: 'RelayTutorial', component: TutorialScreen },
    { name: 'RelayGame', component: GameScreen },
    // Dev-only draft tester -- registered like every other screen, but only
    // reachable via the __DEV__-gated button on HubScreen.
    { name: 'RelayDraftList', component: DraftListScreen },
    { name: 'RelayDraftPlay', component: DraftPlayScreen },
  ],
  entryScreen: 'RelayHub',
};
