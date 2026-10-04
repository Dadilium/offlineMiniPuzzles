import type { Palette } from '../../theme/palettes';

export interface ArrowsPalette {
  /** Resting arrow stroke/fill. */
  line: string;
  /** Board backing plate behind the arrows. */
  plate: string;
  /** Tapped arrow + the arrow it hit, during a bump. */
  danger: string;
  /** Arrow launched by a hint. */
  hint: string;
}

/** Soft lavender lines on a deep plate in dark mode (the reference look), deep indigo on white in light mode. */
export function arrowsPalette(colors: Palette, scheme: 'light' | 'dark'): ArrowsPalette {
  return {
    line: scheme === 'dark' ? '#bdb9f4' : '#3f3c86',
    plate: colors.surface,
    danger: colors.signalRed,
    hint: colors.gold,
  };
}
