import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import type { Palette } from './palettes';
import { useTheme } from './ThemeProvider';

/** Replaces module-scope `StyleSheet.create({ ...colors.x })`, which freezes
 * colors at import time and never repaints on a theme change. The factory
 * re-runs (memoized on the active palette) every time the theme flips. */
export function createThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (colors: Palette) => T
): () => T {
  return function useThemedStyles() {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
