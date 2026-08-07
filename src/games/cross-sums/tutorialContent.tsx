import React from 'react';
import type { CellMark } from './engine';
import { CrossSumsMiniGrid, type MiniGridSpec } from './components/TutorialDiagram';

const EXAMPLE_GRID = [
  [2, 5, 3],
  [7, 1, 4],
  [6, 8, 2],
];

const SOLVED_MARKS: CellMark[][] = [
  ['erased', 'selected', 'selected'],
  ['selected', 'erased', 'selected'],
  ['selected', 'selected', 'erased'],
];

// Mid-solve snapshot for the pen/eraser step: one number circled with the
// pen, one crossed out with the eraser, everything else still undecided.
const PARTIAL_MARKS: CellMark[][] = [
  ['neutral', 'selected', 'neutral'],
  ['neutral', 'erased', 'neutral'],
  ['neutral', 'neutral', 'neutral'],
];

const ROW_TARGETS = [8, 11, 14];
const COL_TARGETS = [13, 13, 7];

const solvedSpec: MiniGridSpec = { rows: 3, cols: 3, grid: EXAMPLE_GRID, marks: SOLVED_MARKS, rowTargets: ROW_TARGETS, colTargets: COL_TARGETS };
const partialSpec: MiniGridSpec = { rows: 3, cols: 3, grid: EXAMPLE_GRID, marks: PARTIAL_MARKS, rowTargets: ROW_TARGETS, colTargets: COL_TARGETS };

// A single combined tutorial (all 3 steps), shown once before the player's
// very first level -- gated on the shared 'all' key in tutorialsSeen
// (useCrossSumsProgress), checked by HubScreen/LevelListScreen/GameScreen.
// Title/desc text lives in locales/{en,fr}.json under `tutorial.<group>[i]`,
// keyed by this same group name + array index -- TutorialScreen resolves it.
export const tutorialDiagrams: Record<string, Array<() => React.ReactElement>> = {
  all: [
    () => <CrossSumsMiniGrid spec={solvedSpec} size={220} />,
    () => <CrossSumsMiniGrid spec={partialSpec} size={220} />,
    () => <CrossSumsMiniGrid spec={solvedSpec} size={220} />,
  ],
};
