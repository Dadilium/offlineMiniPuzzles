import React from 'react';
import { ShikakuMiniGrid, type MiniGridSpec } from './components/TutorialDiagram';

// A 4x4 board whose 3 rectangles tile it exactly (4 + 4 + 8 = 16 cells) --
// used as the "fully solved" illustration across steps.
const CLUES = [
  { r: 0, c: 0, value: 4 },
  { r: 0, c: 2, value: 4 },
  { r: 2, c: 0, value: 8 },
];

const SOLVED_RECTS: MiniGridSpec['rects'] = [
  { r0: 0, c0: 0, r1: 1, c1: 1, clueIndex: 0 },
  { r0: 0, c0: 2, r1: 1, c1: 3, clueIndex: 1 },
  { r0: 2, c0: 0, r1: 3, c1: 3, clueIndex: 2 },
];

// Same board mid-solve: the first clue is drawn correctly, the second is
// undersized (a plausible in-progress drag), the third clue not attempted yet.
const DRAWING_RECTS: MiniGridSpec['rects'] = [
  { r0: 0, c0: 0, r1: 1, c1: 1, clueIndex: 0 },
  { r0: 0, c0: 2, r1: 0, c1: 3, clueIndex: 1 },
];

// Same board with the second clue's rectangle drawn undersized (area 2
// against a clue value of 4) -- a genuine area mismatch, flagged red.
const MISMATCHED_RECTS: MiniGridSpec['rects'] = [
  { r0: 0, c0: 0, r1: 1, c1: 1, clueIndex: 0 },
  { r0: 0, c0: 2, r1: 0, c1: 3, clueIndex: 1, conflict: true },
  { r0: 2, c0: 0, r1: 3, c1: 3, clueIndex: 2 },
];

const solvedSpec: MiniGridSpec = { rows: 4, cols: 4, clues: CLUES, rects: SOLVED_RECTS };
const drawingSpec: MiniGridSpec = { rows: 4, cols: 4, clues: CLUES, rects: DRAWING_RECTS };
const mismatchedSpec: MiniGridSpec = { rows: 4, cols: 4, clues: CLUES, rects: MISMATCHED_RECTS };

// A single combined tutorial (all 3 steps), shown once before the player's
// very first level -- gated on the shared 'all' key in tutorialsSeen
// (useShikakuProgress), checked by HubScreen/LevelListScreen/GameScreen.
// Title/desc text lives in locales/{en,fr}.json under `tutorial.<group>[i]`,
// keyed by this same group name + array index -- TutorialScreen resolves it.
export const tutorialDiagrams: Record<string, Array<() => React.ReactElement>> = {
  all: [
    () => <ShikakuMiniGrid spec={drawingSpec} size={220} />,
    () => <ShikakuMiniGrid spec={mismatchedSpec} size={220} />,
    () => <ShikakuMiniGrid spec={solvedSpec} size={220} />,
  ],
};
