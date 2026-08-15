import type { Ionicons } from '@expo/vector-icons';

// Fixed hue per color id, cycled through the full spectrum so every id up
// to the hardest tier's 11 colors is still clearly distinguishable on the
// dark theme background. Colors don't vary by level (unlike Block Fill's
// per-level palette) -- color IDENTITY is the whole puzzle here, so it must
// stay visually stable across the entire game.
const TUBE_COLORS: string[] = [
  '#ef4444', // red
  '#f97316', // orange
  '#ffd35c', // gold
  '#eab308', // yellow
  '#84cc16', // lime
  '#27b877', // green
  '#14b8a6', // teal
  '#22d3ee', // cyan
  '#4da3ff', // blue
  '#6366f1', // indigo
  '#a855f7', // purple
  '#f472b6', // pink
];

export function colorForId(colorId: number): string {
  return TUBE_COLORS[colorId % TUBE_COLORS.length];
}

export const MAX_TUBE_COLORS = TUBE_COLORS.length;

/** One shape per color id, index-aligned with `TUBE_COLORS` -- the
 * colorblind-friendly mode's whole job is letting a player match tubes by
 * SHAPE alone, so these must read as distinct silhouettes even at the small
 * size a tube segment renders at, not just distinct as icons in isolation.
 * Deliberately not color-coded here (red isn't tied to "star", etc.) since
 * that would just be reintroducing a color dependency through the back door. */
const COLOR_ICONS: Array<keyof typeof Ionicons.glyphMap> = [
  'star',
  'heart',
  'square',
  'triangle',
  'ellipse',
  'diamond',
  'flower',
  'leaf',
  'flash',
  'moon',
  'sunny',
  'snow',
];

export function iconForId(colorId: number): keyof typeof Ionicons.glyphMap {
  return COLOR_ICONS[colorId % COLOR_ICONS.length];
}
