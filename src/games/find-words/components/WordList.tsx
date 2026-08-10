import React, { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
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
  const scale = useRef(new Animated.Value(1)).current;
  const wasFound = useRef(isFound);

  useEffect(() => {
    if (isFound && !wasFound.current) {
      scale.setValue(1);
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.12, friction: 4, tension: 220, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 5, tension: 220, useNativeDriver: true }),
      ]).start();
    }
    wasFound.current = isFound;
  }, [isFound, scale]);

  return (
    <Animated.View
      style={[
        styles.chip,
        isFound && { backgroundColor: palette.fill, borderColor: palette.border },
        { transform: [{ scale }] },
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
