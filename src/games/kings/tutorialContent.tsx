import React from 'react';
import { KingsMiniGrid, tutorialCells } from './components/TutorialDiagram';

export interface TutorialStep {
  title: string;
  desc: string;
  diagram: () => React.ReactElement;
}

// A single combined tutorial (all 4 steps), shown once before the player's
// very first level -- gated on the shared 'all' key in tutorialsSeen
// (useKingsProgress), checked by HubScreen/LevelListScreen/GameScreen.
export const tutorialGroups: Record<string, TutorialStep[]> = {
  all: [
    {
      title: 'One king per realm',
      desc: 'The grid is divided into colored REALMS. Every row, every column, and every realm must end up with exactly one king.',
      diagram: () => (
        <KingsMiniGrid
          n={4}
          size={200}
          cells={tutorialCells({ '1,0': 'king', '0,2': 'king', '3,1': 'king', '2,3': 'king' })}
        />
      ),
    },
    {
      title: "Kings can't touch",
      desc: 'No two kings may sit in adjacent cells — not sharing an edge, and not even diagonally. Give every king a little breathing room.',
      diagram: () => <KingsMiniGrid n={4} size={200} cells={tutorialCells({ '1,1': 'king', '2,2': 'king' })} />,
    },
    {
      title: "Mark cells you've ruled out",
      desc: "Tap once to leave a small MARK on a cell you know can't hold a king. Tap again to place the crown. Tap a third time to clear it.",
      diagram: () => (
        <KingsMiniGrid
          n={4}
          size={200}
          cells={tutorialCells({
            '1,0': 'king',
            '0,0': 'mark',
            '0,1': 'mark',
            '1,1': 'mark',
            '1,2': 'mark',
            '1,3': 'mark',
            '2,0': 'mark',
            '2,1': 'mark',
            '3,0': 'mark',
          })}
        />
      ),
    },
    {
      title: 'Placing a king marks the rest',
      desc: "The instant you crown a cell, every cell that's now impossible — same row, column, realm, and anything touching — gets dotted for you automatically. Remove the king and those dots clear right back up.",
      diagram: () => (
        <KingsMiniGrid
          n={4}
          size={200}
          cells={tutorialCells({
            '1,1': 'king',
            '0,0': 'mark',
            '0,1': 'mark',
            '0,2': 'mark',
            '1,0': 'mark',
            '1,2': 'mark',
            '1,3': 'mark',
            '2,0': 'mark',
            '2,1': 'mark',
            '2,2': 'mark',
            '3,1': 'mark',
          })}
        />
      ),
    },
  ],
};
