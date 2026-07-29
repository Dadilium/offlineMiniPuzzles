import React from 'react';
import { ColorSortMiniTubes, type MiniTubesSpec } from './components/TutorialDiagram';

export interface TutorialStep {
  title: string;
  desc: string;
  diagram: () => React.ReactElement;
}

const CAPACITY = 3;
const BEFORE_POUR: MiniTubesSpec = { tubes: [[1, 0, 0], [0, 1, 1], []], capacity: CAPACITY, highlight: { from: 1, to: 2 } };
const AFTER_POUR: MiniTubesSpec = { tubes: [[1, 0, 0], [0], [1, 1]], capacity: CAPACITY, highlight: { from: 1, to: 2 } };
const SOLVED: MiniTubesSpec = { tubes: [[0, 0, 0], [1, 1, 1], [2, 2, 2], [], []], capacity: CAPACITY };

// A single combined tutorial (all 3 steps), shown once before the player's
// very first level -- gated on the shared 'all' key in tutorialsSeen
// (useColorSortProgress), checked by HubScreen/LevelListScreen/GameScreen.
export const tutorialGroups: Record<string, TutorialStep[]> = {
  all: [
    {
      title: 'Pour onto a matching color, or an empty tube',
      desc: "Tap a tube to pick it up, then tap another to pour. A pour only works if the other tube is empty or its top color matches yours.",
      diagram: () => <ColorSortMiniTubes spec={BEFORE_POUR} size={220} />,
    },
    {
      title: 'The whole top group moves together',
      desc: "You don't choose how much pours -- every consecutive unit of that color on top moves at once, as much as fits.",
      diagram: () => <ColorSortMiniTubes spec={AFTER_POUR} size={220} />,
    },
    {
      title: 'Get every color into one tube each to win',
      desc: 'A tube counts once it is completely empty or completely full of a single color. Sort every color that way and the board is solved. Stuck? Hint highlights the next move.',
      diagram: () => <ColorSortMiniTubes spec={SOLVED} size={220} />,
    },
  ],
};
