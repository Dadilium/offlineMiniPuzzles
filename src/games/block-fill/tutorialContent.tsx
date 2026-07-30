import React from 'react';
import { BlockFillMiniGrid } from './components/TutorialDiagram';

// A single combined tutorial (all 4 steps), shown once before the player's
// very first level -- gated on the shared 'all' key in tutorialsSeen
// (useBlockFillProgress), checked by HubScreen/LevelListScreen/GameScreen.
// Title/desc text lives in locales/{en,fr}.json under `tutorial.<group>[i]`,
// keyed by this same group name + array index -- TutorialScreen resolves it.
export const tutorialDiagrams: Record<string, Array<() => React.ReactElement>> = {
  all: [
    () => (
      <BlockFillMiniGrid
        rows={3}
        cols={4}
        path={[
          { r: 1, c: 0 },
          { r: 1, c: 1 },
          { r: 1, c: 2 },
          { r: 0, c: 2 },
        ]}
      />
    ),
    () => (
      <BlockFillMiniGrid
        rows={3}
        cols={4}
        obstacles={[
          { r: 0, c: 1 },
          { r: 1, c: 1 },
          { r: 2, c: 3 },
        ]}
        path={[
          { r: 0, c: 0 },
          { r: 1, c: 0 },
          { r: 2, c: 0 },
          { r: 2, c: 1 },
          { r: 2, c: 2 },
          { r: 1, c: 2 },
        ]}
      />
    ),
    () => (
      <BlockFillMiniGrid
        rows={3}
        cols={4}
        path={[
          { r: 0, c: 0 },
          { r: 0, c: 1 },
          { r: 0, c: 2 },
          { r: 1, c: 2 },
          { r: 2, c: 2 },
        ]}
        highlight={{ r: 0, c: 1 }}
      />
    ),
    () => (
      <BlockFillMiniGrid
        rows={3}
        cols={4}
        path={[
          { r: 1, c: 1 },
          { r: 0, c: 1 },
          { r: 0, c: 2 },
          { r: 1, c: 2 },
        ]}
      />
    ),
  ],
};
