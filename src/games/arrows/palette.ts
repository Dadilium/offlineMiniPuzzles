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
  /** A tapped arrow that's free and flying out. */
  success: string;
  /** Combo-streak sparkles trailing an exiting arrow. */
  sparkle: string;
}

/** Soft lavender lines on a deep plate in dark mode (the reference look), deep indigo on white in light mode. */
export function arrowsPalette(colors: Palette, scheme: 'light' | 'dark'): ArrowsPalette {
  return {
    line: scheme === 'dark' ? '#bdb9f4' : '#3f3c86',
    plate: colors.surface,
    danger: colors.signalRed,
    hint: colors.gold,
    success: colors.success,
    // Gold washes out on the white light-mode plate; a deeper amber keeps the sparkle readable.
    sparkle: scheme === 'dark' ? colors.gold : '#e09a00',
  };
}
