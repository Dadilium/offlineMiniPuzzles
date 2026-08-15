import React, { useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { fonts, radii } from '../../../theme/tokens';
import { createThemedStyles } from '../../../theme/createThemedStyles';
import { paletteForWord } from '../palette';
import type { Placement } from '../types';

interface ChipProps {
  word: string;
  isFound: boolean;
  palette: { fill: string; border: string };
}

/** One word's chip -- a quick "pop" the moment it flips to found, same idiom as every other game's found/placed animations. */
function WordChip({ word, isFound, palette }: ChipProps) {
  const styles = useStyles();
  const scale = useSharedValue(1);
  const wasFound = useRef(isFound);

  useEffect(() => {
    if (isFound && !wasFound.current) {
      scale.value = 1;
      scale.value = withSequence(
        withSpring(1.12, { duration: 200, dampingRatio: 0.5 }),
        withSpring(1, { duration: 200, dampingRatio: 0.65 })
      );
    }
    wasFound.current = isFound;
  }, [isFound, scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View
      style={[
        styles.chip,
        isFound && { backgroundColor: palette.fill, borderColor: palette.border },
        animatedStyle,
      ]}
    >
      <Text style={[styles.word, isFound && styles.wordFound]}>{word}</Text>
    </Animated.View>
  );
}

interface Props {
  placements: Placement[];
  foundIndices: number[];
}

/** The word list at the bottom of the game screen -- each word crosses off the moment its capsule locks in on the grid above. */
export default function WordList({ placements, foundIndices }: Props) {
  const styles = useStyles();
  const found = new Set(foundIndices);
  return (
    <View style={styles.wrap}>
      {placements.map((placement, index) => (
        <WordChip key={index} word={placement.word} isFound={found.has(index)} palette={paletteForWord(index)} />
      ))}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, paddingHorizontal: 12 },
  chip: {
    backgroundColor: colors.surface2,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  word: {
    fontFamily: fonts.mono,
    fontWeight: '700',
    fontSize: 13,
    color: colors.text,
    letterSpacing: 0.5,
  },
  wordFound: {
    color: colors.textFaint,
    textDecorationLine: 'line-through',
  },
}));
