import React from 'react';
import { TentsAndTreesMiniGrid, type MiniGridSpec } from './components/TutorialDiagram';

export interface TutorialStep {
  title: string;
  desc: string;
  diagram: () => React.ReactElement;
}

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
export const tutorialGroups: Record<string, TutorialStep[]> = {
  all: [
    {
      title: 'Every tree needs a matching tent',
      desc: 'Each tree must pair with exactly one tent directly above, below, or beside it — never diagonal, and never sharing a tent with another tree.',
      diagram: () => <TentsAndTreesMiniGrid spec={solvedSpec} size={220} />,
    },
    {
      title: 'Tap a cell to place a tent — none can touch',
      desc: 'Tap any empty cell next to a tree to pitch a tent there, tap again to remove it. Tents can never touch another tent, not even diagonally.',
      diagram: () => <TentsAndTreesMiniGrid spec={partialSpec} size={220} />,
    },
    {
      title: 'Match every row and column count to win',
      desc: 'The numbers along the edges show how many tents belong in that row or column. Once every tree is matched and every count lines up, the board is solved — stuck? Hint reveals one cell for you.',
      diagram: () => <TentsAndTreesMiniGrid spec={solvedSpec} size={220} />,
    },
  ],
};
