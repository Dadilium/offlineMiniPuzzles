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
  /**
   * Certificate produced by generation/boardBuilder.ts: replaying these
   * pairs in order against `grid` is guaranteed legal and clears the board.
   * Generation-time proof only -- never read at runtime (hints and stuck
   * detection always re-scan the live board, see engine.ts).
   */
  solutionOrder: Array<[Cell, Cell]>;
}
