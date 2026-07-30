import React from 'react';
import { KingsMiniGrid, tutorialCells } from './components/TutorialDiagram';

// A single combined tutorial (all 4 steps), shown once before the player's
// very first level -- gated on the shared 'all' key in tutorialsSeen
// (useKingsProgress), checked by HubScreen/LevelListScreen/GameScreen.
// Title/desc text lives in locales/{en,fr}.json under `tutorial.<group>[i]`,
// keyed by this same group name + array index -- TutorialScreen resolves it.
export const tutorialDiagrams: Record<string, Array<() => React.ReactElement>> = {
  all: [
    () => (
      <KingsMiniGrid
        n={4}
        size={200}
        cells={tutorialCells({ '1,0': 'king', '0,2': 'king', '3,1': 'king', '2,3': 'king' })}
      />
    ),
    () => <KingsMiniGrid n={4} size={200} cells={tutorialCells({ '1,1': 'king', '2,2': 'king' })} />,
    () => (
      <KingsMiniGrid
        n={4}
        size={200}
        cells={tutorialCells({
          '1,0': 'king',
          '0,0': 'mark',
          '0,1': 'mark',
          '1,1': 'mark',
          '1,2': 'mark',
          '1,3': 'mark',
          '2,0': 'mark',
          '2,1': 'mark',
          '3,0': 'mark',
        })}
      />
    ),
    () => (
      <KingsMiniGrid
        n={4}
        size={200}
        cells={tutorialCells({
          '1,1': 'king',
          '0,0': 'mark',
          '0,1': 'mark',
          '0,2': 'mark',
          '1,0': 'mark',
          '1,2': 'mark',
          '1,3': 'mark',
          '2,0': 'mark',
          '2,1': 'mark',
          '2,2': 'mark',
          '3,1': 'mark',
        })}
      />
    ),
  ],
};
