import React from 'react';
import { Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { MatchingNumbersMiniGrid } from './components/TutorialDiagram';

// A single combined tutorial (all 5 steps), shown once before the player's
// very first level -- gated on the shared 'all' key in tutorialsSeen
// (useMatchingNumbersProgress), checked by HubScreen/LevelListScreen/GameScreen.
// Title/desc text lives in locales/{en,fr}.json under `tutorial.<group>[i]`,
// keyed by this same group name + array index -- TutorialScreen resolves it.
export const tutorialDiagrams: Record<string, Array<() => React.ReactElement>> = {
  all: [
    () => (
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
    () => (
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
    () => (
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
    () => (
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
    () => (
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
  ],
};
