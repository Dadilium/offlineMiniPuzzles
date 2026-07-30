import React from 'react';
import { ColorSortMiniTubes, type MiniTubesSpec } from './components/TutorialDiagram';

const CAPACITY = 3;
const BEFORE_POUR: MiniTubesSpec = { tubes: [[1, 0, 0], [0, 1, 1], []], capacity: CAPACITY, highlight: { from: 1, to: 2 } };
const AFTER_POUR: MiniTubesSpec = { tubes: [[1, 0, 0], [0], [1, 1]], capacity: CAPACITY, highlight: { from: 1, to: 2 } };
const SOLVED: MiniTubesSpec = { tubes: [[0, 0, 0], [1, 1, 1], [2, 2, 2], [], []], capacity: CAPACITY };

// A single combined tutorial (all 3 steps), shown once before the player's
// very first level -- gated on the shared 'all' key in tutorialsSeen
// (useColorSortProgress), checked by HubScreen/LevelListScreen/GameScreen.
// Title/desc text lives in locales/{en,fr}.json under `tutorial.<group>[i]`,
// keyed by this same group name + array index -- TutorialScreen resolves it.
export const tutorialDiagrams: Record<string, Array<() => React.ReactElement>> = {
  all: [
    () => <ColorSortMiniTubes spec={BEFORE_POUR} size={220} />,
    () => <ColorSortMiniTubes spec={AFTER_POUR} size={220} />,
    () => <ColorSortMiniTubes spec={SOLVED} size={220} />,
  ],
};
