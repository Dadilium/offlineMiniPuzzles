import React from 'react';
import { TentsAndTreesMiniGrid, type MiniGridSpec } from './components/TutorialDiagram';

const TREES = [
  [true, false, false],
  [false, false, false],
  [false, false, true],
];

const SOLVED_TENTS = [
  [false, false, false],
  [true, false, true],
  [false, false, false],
];

const PARTIAL_TENTS = [
  [false, false, false],
  [true, false, false],
  [false, false, false],
];

const ROW_TARGETS = [0, 2, 0];
const COL_TARGETS = [1, 0, 1];

const solvedSpec: MiniGridSpec = { rows: 3, cols: 3, trees: TREES, tents: SOLVED_TENTS, rowTargets: ROW_TARGETS, colTargets: COL_TARGETS };
const partialSpec: MiniGridSpec = { rows: 3, cols: 3, trees: TREES, tents: PARTIAL_TENTS, rowTargets: ROW_TARGETS, colTargets: COL_TARGETS };

// A single combined tutorial (all 3 steps), shown once before the player's
// very first level -- gated on the shared 'all' key in tutorialsSeen
// (useTentsAndTreesProgress), checked by HubScreen/LevelListScreen/GameScreen.
// Title/desc text lives in locales/{en,fr}.json under `tutorial.<group>[i]`,
// keyed by this same group name + array index -- TutorialScreen resolves it.
export const tutorialDiagrams: Record<string, Array<() => React.ReactElement>> = {
  all: [
    () => <TentsAndTreesMiniGrid spec={solvedSpec} size={220} />,
    () => <TentsAndTreesMiniGrid spec={partialSpec} size={220} />,
    () => <TentsAndTreesMiniGrid spec={solvedSpec} size={220} />,
  ],
};
