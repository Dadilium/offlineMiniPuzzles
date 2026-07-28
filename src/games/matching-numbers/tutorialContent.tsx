import React from 'react';
import { Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { MatchingNumbersMiniGrid } from './components/TutorialDiagram';

export interface TutorialStep {
  title: string;
  desc: string;
  diagram: () => React.ReactElement;
}

// A single combined tutorial (all 5 steps), shown once before the player's
// very first level -- gated on the shared 'all' key in tutorialsSeen
// (useMatchingNumbersProgress), checked by HubScreen/LevelListScreen/GameScreen.
export const tutorialGroups: Record<string, TutorialStep[]> = {
  all: [
    {
      title: 'Equal numbers match',
      desc: 'Tap any two tiles. They match if they show the same number -- clear them and keep going.',
      diagram: () => (
        <MatchingNumbersMiniGrid
          cells={[
            { r: 0, c: 0, value: 3 },
            { r: 0, c: 1, value: 8 },
            { r: 0, c: 2, value: 2 },
            { r: 0, c: 3, value: 5 },
            { r: 1, c: 0, value: 6, highlighted: true },
            { r: 1, c: 3, value: 4 },
            { r: 2, c: 0, value: 7 },
            { r: 2, c: 1, value: 1 },
            { r: 2, c: 2, value: 9 },
            { r: 2, c: 3, value: 8 },
            { r: 1, c: 2, value: 6, highlighted: true },
          ]}
          connector={{
            path: [
              { r: 1, c: 0 },
              { r: 1, c: 2 },
            ],
          }}
        />
      ),
    },
    {
      title: 'Numbers summing to 10 also match',
      desc: '3 + 7 = 10 -- that pairing counts as a match too, just like two equal numbers.',
      diagram: () => (
        <MatchingNumbersMiniGrid
          cells={[
            { r: 0, c: 0, value: 4 },
            { r: 0, c: 1, value: 3, highlighted: true },
            { r: 0, c: 2, value: 9 },
            { r: 0, c: 3, value: 2 },
            { r: 1, c: 0, value: 5 },
            { r: 1, c: 2, value: 6 },
            { r: 1, c: 3, value: 1 },
            { r: 2, c: 0, value: 8 },
            { r: 2, c: 1, value: 7, highlighted: true },
            { r: 2, c: 2, value: 4 },
            { r: 2, c: 3, value: 9 },
          ]}
          connector={{
            path: [
              { r: 0, c: 1 },
              { r: 2, c: 1 },
            ],
          }}
        />
      ),
    },
    {
      title: 'A path can bend once',
      desc: "Tiles don't need to share a row or column -- a connecting path with a single 90-degree turn through an empty cell still counts. Diagonal jumps and more than one bend don't.",
      diagram: () => (
        <MatchingNumbersMiniGrid
          cells={[
            { r: 0, c: 0, value: 5, highlighted: true },
            { r: 0, c: 3, value: 8 },
            { r: 1, c: 0, value: 2 },
            { r: 1, c: 1, value: 9 },
            { r: 1, c: 3, value: 3 },
            { r: 2, c: 0, value: 6 },
            { r: 2, c: 1, value: 4 },
            { r: 2, c: 2, value: 5, highlighted: true },
            { r: 2, c: 3, value: 7 },
          ]}
          connector={{
            path: [
              { r: 0, c: 0 },
              { r: 0, c: 2 },
              { r: 2, c: 2 },
            ],
          }}
        />
      ),
    },
    {
      title: "Blocked paths don't count",
      desc: 'If the straight line -- or the single bend -- passes through a tile that still has a number on it, the path is blocked. Clear it first, or pick a different pair.',
      diagram: () => (
        <MatchingNumbersMiniGrid
          cells={[
            { r: 0, c: 0, value: 5, highlighted: true },
            { r: 0, c: 1, value: 2 },
            { r: 0, c: 2, value: 9 },
            { r: 0, c: 3, value: 8 },
            { r: 1, c: 0, value: 1 },
            { r: 1, c: 1, value: 6 },
            { r: 1, c: 2, value: 3 },
            { r: 1, c: 3, value: 4 },
            { r: 2, c: 0, value: 7 },
            { r: 2, c: 1, value: 8 },
            { r: 2, c: 2, value: 5, highlighted: true },
            { r: 2, c: 3, value: 2 },
          ]}
          connector={{
            path: [
              { r: 0, c: 0 },
              { r: 0, c: 2 },
              { r: 2, c: 2 },
            ],
            blocked: true,
          }}
        />
      ),
    },
    {
      title: 'Stuck? Use Add Numbers. Clear everything to win.',
      desc: "No path? Tap Add Numbers to bring every remaining tile down as a new row -- it's a limited resource (5 per level), so use it when you need it. Clear every tile on the board, including anything you've added, to win the level.",
      diagram: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ flex: 1 }}>
            <MatchingNumbersMiniGrid
              cells={[
                { r: 0, c: 0, value: 4 },
                { r: 1, c: 2, value: 6 },
                { r: 2, c: 3, value: 9 },
              ]}
            />
          </View>
          <Text style={{ fontSize: 18, color: colors.textDim }}>→</Text>
          <View style={{ flex: 1 }}>
            <MatchingNumbersMiniGrid
              rows={4}
              cells={[
                { r: 0, c: 0, value: 4 },
                { r: 1, c: 2, value: 6 },
                { r: 2, c: 3, value: 9 },
                { r: 3, c: 0, value: 4, highlighted: true },
                { r: 3, c: 1, value: 6, highlighted: true },
                { r: 3, c: 2, value: 9, highlighted: true },
              ]}
            />
          </View>
        </View>
      ),
    },
  ],
};
