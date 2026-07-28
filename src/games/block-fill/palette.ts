export interface BlockFillPalette {
  fill: string;
  stroke: string;
}

// Each pair is one hue, fill/stroke as slightly different shades of it (per
// spec: distinct enough to read as two layers, not identical). Cycled
// deterministically by level index so the board's look varies level to
// level without needing per-level authoring.
const PALETTES: BlockFillPalette[] = [
  { fill: '#2f5fd6', stroke: '#5b82f5' }, // blue
  { fill: '#7c3ed1', stroke: '#a855f7' }, // purple
  { fill: '#0fa8bd', stroke: '#22d3ee' }, // cyan
  { fill: '#d63e8f', stroke: '#f472b6' }, // pink
  { fill: '#1f9d63', stroke: '#27b877' }, // green
  { fill: '#d69a1f', stroke: '#ffd35c' }, // gold
];

export function paletteForLevel(levelIndex: number): BlockFillPalette {
  return PALETTES[((levelIndex % PALETTES.length) + PALETTES.length) % PALETTES.length];
}
