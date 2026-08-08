export interface FindWordsPalette {
  /** Translucent capsule fill (8-digit hex, alpha suffix). */
  fill: string;
  /** Always full-opacity -- keeps the capsule's outline legible over the fill. */
  border: string;
}

// Eight fresh hues (not copied from any other game's palette file), so every
// simultaneously-found word on the board reads as visually distinct -- the
// "all different" bubble colors called for in the approved plan.
const PALETTES: FindWordsPalette[] = [
  { border: '#ff6b5b', fill: '#ff6b5b33' }, // coral
  { border: '#23cd9a', fill: '#23cd9a33' }, // mint
  { border: '#eec141', fill: '#eec14133' }, // sunflower
  { border: '#b16ef0', fill: '#b16ef033' }, // orchid
  { border: '#ef4d78', fill: '#ef4d7833' }, // crimson
  { border: '#a6d94a', fill: '#a6d94a33' }, // chartreuse
  { border: '#4f8fe0', fill: '#4f8fe033' }, // denim
  { border: '#d1489e', fill: '#d1489e33' }, // plum
];

/** Stable per placement index (not discovery order) so a found word's color never shifts on redraw. */
export function paletteForWord(placementIndex: number): FindWordsPalette {
  const len = PALETTES.length;
  return PALETTES[((placementIndex % len) + len) % len];
}
