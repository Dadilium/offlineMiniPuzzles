import React from 'react';
import { FindWordsMiniGrid, type MiniGridSpec } from './components/TutorialDiagram';

// A 5x5 board with two words -- CAT reading across, DOG reading down --
// reused across all 3 steps, same "one illustrative board, evolving state"
// approach as Shikaku's tutorial.
const GRID: string[][] = [
  ['C', 'A', 'T', 'K', 'B'],
  ['M', 'R', 'S', 'D', 'N'],
  ['P', 'L', 'F', 'O', 'H'],
  ['W', 'J', 'K', 'G', 'B'],
  ['R', 'S', 'N', 'P', 'L'],
];

const CAT = [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }];
const CAT_PARTIAL = [{ r: 0, c: 0 }, { r: 0, c: 1 }];
const DOG = [{ r: 1, c: 3 }, { r: 2, c: 3 }, { r: 3, c: 3 }];

// Step 1: mid-drag over part of CAT, in the neutral "selecting" color.
const draggingSpec: MiniGridSpec = { size: 5, grid: GRID, highlights: [{ cells: CAT_PARTIAL, colorIndex: 0, dragging: true }] };

// Step 2: CAT found (its own color), DOG being dragged (still neutral).
const oneFoundSpec: MiniGridSpec = {
  size: 5,
  grid: GRID,
  highlights: [
    { cells: CAT, colorIndex: 0 },
    { cells: DOG, colorIndex: 1, dragging: true },
  ],
};

// Step 3: both found, each keeping its own distinct color.
const bothFoundSpec: MiniGridSpec = {
  size: 5,
  grid: GRID,
  highlights: [
    { cells: CAT, colorIndex: 0 },
    { cells: DOG, colorIndex: 1 },
  ],
};

// A single combined tutorial (all 3 steps), shown once before the player's
// very first level -- gated on the shared 'all' key in tutorialsSeen
// (useFindWordsProgress), checked by HubScreen/LevelListScreen/GameScreen.
// Title/desc text lives in locales/{en,fr}.json under `tutorial.<group>[i]`,
// keyed by this same group name + array index -- TutorialScreen resolves it.
export const tutorialDiagrams: Record<string, Array<() => React.ReactElement>> = {
  all: [
    () => <FindWordsMiniGrid spec={draggingSpec} pixelSize={220} />,
    () => <FindWordsMiniGrid spec={oneFoundSpec} pixelSize={220} />,
    () => <FindWordsMiniGrid spec={bothFoundSpec} pixelSize={220} />,
  ],
};
