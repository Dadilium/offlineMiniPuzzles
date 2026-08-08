export interface Cell {
  r: number;
  c: number;
}

// 1-9, or null for a cleared/empty cell.
export type GridValue = number | null;

export interface MatchingNumbersLevel {
  title?: string;
  instructions?: string;
  rows: number;
  cols: number;
  grid: GridValue[][];
}
