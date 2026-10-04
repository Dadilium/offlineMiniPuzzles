import React from 'react';
import { ArrowsMiniBoard, type MiniBoardSpec } from './components/TutorialDiagram';

// A 4x4 board with a three-deep chain: B is free, A waits on B, C waits on
// A, and D waits on C -- used across every step.
const ARROWS: MiniBoardSpec['arrows'] = [
  [[0, 0], [0, 1], [0, 2]], // A -> right, blocked by B
  [[2, 3], [1, 3], [0, 3]], // B -> up, free
  [[3, 0], [3, 1], [3, 2], [2, 2], [1, 2]], // C -> up, blocked by A
  [[1, 0], [2, 0], [2, 1]], // D -> right, blocked by C
];

const exitSpec: MiniBoardSpec = { rows: 4, cols: 4, arrows: ARROWS, exiting: 1 };
const bumpSpec: MiniBoardSpec = { rows: 4, cols: 4, arrows: ARROWS, bump: { arrow: 2, blocker: 0 }, cleared: [1] };
const chainSpec: MiniBoardSpec = { rows: 4, cols: 4, arrows: ARROWS, exiting: 2, cleared: [0, 1] };

// A single combined tutorial, shown once before the player's first level --
// gated on the shared 'all' key in tutorialsSeen. Title/desc text lives in
// locales/{en,fr}.json under `tutorial.<group>[i]`.
export const tutorialDiagrams: Record<string, Array<() => React.ReactElement>> = {
  all: [
    () => <ArrowsMiniBoard spec={exitSpec} size={200} />,
    () => <ArrowsMiniBoard spec={bumpSpec} size={200} />,
    () => <ArrowsMiniBoard spec={chainSpec} size={200} />,
  ],
};
