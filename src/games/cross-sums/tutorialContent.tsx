import React from 'react';
import { CrossSumsMiniGrid, type MiniGridSpec } from './components/TutorialDiagram';

export interface TutorialStep {
  title: string;
  desc: string;
  diagram: () => React.ReactElement;
}

const EXAMPLE_GRID = [
  [2, 5, 3],
  [7, 1, 4],
  [6, 8, 2],
];

const SOLVED_MASK = [
  [false, true, true],
  [true, false, true],
  [true, true, false],
];

const PARTIAL_MASK = [
  [true, true, true],
  [true, false, true],
  [true, true, false],
];

const ROW_TARGETS = [8, 11, 14];
const COL_TARGETS = [13, 13, 7];

const solvedSpec: MiniGridSpec = { rows: 3, cols: 3, grid: EXAMPLE_GRID, mask: SOLVED_MASK, rowTargets: ROW_TARGETS, colTargets: COL_TARGETS };
const partialSpec: MiniGridSpec = { rows: 3, cols: 3, grid: EXAMPLE_GRID, mask: PARTIAL_MASK, rowTargets: ROW_TARGETS, colTargets: COL_TARGETS };

// A single combined tutorial (all 3 steps), shown once before the player's
// very first level -- gated on the shared 'all' key in tutorialsSeen
// (useCrossSumsProgress), checked by HubScreen/LevelListScreen/GameScreen.
export const tutorialGroups: Record<string, TutorialStep[]> = {
  all: [
    {
      title: 'Every row and column has a target',
      desc: 'The numbers along the right edge and bottom edge are the sums each row and column must reach — but only counting the cells you keep.',
      diagram: () => <CrossSumsMiniGrid spec={solvedSpec} size={220} />,
    },
    {
      title: 'Tap a number to keep or cross it out',
      desc: 'Every cell starts kept. Tap one to cross it out of the sum, tap again to bring it back — the cell value never changes, only whether it counts.',
      diagram: () => <CrossSumsMiniGrid spec={partialSpec} size={220} />,
    },
    {
      title: 'Match every target to win',
      desc: "Once every row's and every column's kept-cell sum matches its target, the board is solved. Stuck? Hint reveals one cell for you.",
      diagram: () => <CrossSumsMiniGrid spec={solvedSpec} size={220} />,
    },
  ],
};
