export interface ShikakuPalette {
  /** Translucent region fill (8-digit hex, alpha suffix). */
  fill: string;
  /** Always full-opacity -- the partition boundary must stay legible regardless of conflict/color state. */
  border: string;
}

// Eight fresh hues (not copied from any other game's palette file), spread
// around the wheel and away from pure red so a mismatched-area rectangle
// (rendered in colors.signalRed, see ShikakuGrid) never gets confused with a
// correctly-colored one. Fill is the border hue with a low alpha suffix so
// the underlying clue number stays legible through it.
const PALETTES: ShikakuPalette[] = [
  { border: '#4f8ff7', fill: '#4f8ff733' }, // sky blue
  { border: '#e0a23d', fill: '#e0a23d33' }, // amber
  { border: '#2bb3a3', fill: '#2bb3a333' }, // teal
  { border: '#9b6bf2', fill: '#9b6bf233' }, // violet
  { border: '#e0668c', fill: '#e0668c33' }, // muted rose (distinct from signalRed)
  { border: '#8fc93a', fill: '#8fc93a33' }, // lime
  { border: '#33c2d1', fill: '#33c2d133' }, // cyan
  { border: '#6b7fd6', fill: '#6b7fd633' }, // indigo
];

/** Stable per clueIndex (not placement order, not area) so a rectangle's color never shifts on redraw. */
export function paletteForClue(clueIndex: number): ShikakuPalette {
  const len = PALETTES.length;
  return PALETTES[((clueIndex % len) + len) % len];
}
