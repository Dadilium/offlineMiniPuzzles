export interface Clue {
  r: number;
  c: number;
  value: number;
}

export interface RectBounds {
  r0: number;
  c0: number;
  r1: number;
  c1: number;
}

export interface PlacedRect extends RectBounds {
  clueIndex: number;
}

export interface ShikakuLevel {
  title?: string;
  instructions?: string;
  rows: number;
  cols: number;
  clues: Clue[];
  /** solutionRects[i] <-> clues[i], uniqueness-verified at generation time. */
  solutionRects: RectBounds[];
}

export type ShikakuPlayerState = PlacedRect[];
