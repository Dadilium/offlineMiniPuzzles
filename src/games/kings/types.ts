// 0 = empty, 1 = mark (player-placed "ruled out" dot), 2 = king,
// 3 = hinted king (revealed via hint -- locked, can't be cycled away).
export type CellState = 0 | 1 | 2 | 3;

export interface KingsLevel {
  title?: string;
  instructions?: string;
  /** Board is n x n. */
  n: number;
  /** Region id per cell, regions[row][col]. Exactly n region ids (0..n-1). */
  regions: number[][];
  /** The unique solution: king position per row, as [row, col] pairs. */
  solution: Array<[number, number]>;
}

export interface KingPos {
  r: number;
  c: number;
  region: number;
}

export interface KingsStateResult {
  kings: KingPos[];
  /** Set of "r,c" keys for every king currently in conflict with another. */
  conflictSet: Set<string>;
  win: boolean;
}
