export interface Cell {
  r: number;
  c: number;
}

// Only 3 axes are ever used for storage (E/S/SE = "reading order" and their
// exact opposites W/N/NW = "reversed") -- deliberately no anti-diagonal
// (NE/SW) axis, per the approved plan. Which of the 6 a tier is allowed to
// place in is a real difficulty knob: a word stored E/S/SE reads correctly
// when scanned left-to-right/top-to-bottom, so it's easier to spot by eye
// than the same word stored W/N/NW, even though a player can drag-select
// either one in either direction (see engine.ts's matchPlacement).
export type Direction = 'E' | 'W' | 'N' | 'S' | 'SE' | 'NW';

export interface Placement {
  word: string;
  /** Row/col of the word's first letter (index 0), before `direction` is applied. */
  row: number;
  col: number;
  direction: Direction;
}

export interface FindWordsLevel {
  rows: number;
  cols: number;
  /** Uppercase single characters, rows x cols. Filler cells are random letters; placed-word cells spell out `placements`. */
  grid: string[][];
  placements: Placement[];
}

/** Indices into `level.placements` the player has found so far. */
export type FindWordsPlayerState = number[];
