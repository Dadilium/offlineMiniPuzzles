import React from 'react';
import { BlockFillMiniGrid } from './components/TutorialDiagram';

export interface TutorialStep {
  title: string;
  desc: string;
  diagram: () => React.ReactElement;
}

// A single combined tutorial (all 4 steps), shown once before the player's
// very first level -- gated on the shared 'all' key in tutorialsSeen
// (useBlockFillProgress), checked by HubScreen/LevelListScreen/GameScreen.
export const tutorialGroups: Record<string, TutorialStep[]> = {
  all: [
    {
      title: 'Drag to fill every open cell',
      desc: 'Press and drag through the open cells, one step at a time, to color them in. The board is won as soon as every open cell is colored.',
      diagram: () => (
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
    },
    {
      title: 'Obstacles block the way',
      desc: "Dark cells are obstacles -- you can't step on them. Your path has to weave around them to reach every open cell.",
      diagram: () => (
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
    },
    {
      title: "Stuck? Touch back along your own trail",
      desc: "Touching an earlier point on the trail you've already drawn rewinds the path back to there, uncoloring everything after it. No move is ever permanent -- there's no way to lose, just rewind and try a different route.",
      diagram: () => (
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
    },
    {
      title: "Can't cross your own trail",
      desc: 'The path can never revisit a cell it has already colored -- plan your route so it does not trap itself before every open cell is filled.',
      diagram: () => (
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
    },
  ],
};
