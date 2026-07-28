export interface CrossSumsLevel {
  title?: string;
  instructions?: string;
  rows: number;
  cols: number;
  /** Pre-filled digits, never edited. grid[row][col]. */
  grid: number[][];
  rowTargets: number[];
  colTargets: number[];
  /**
   * Verified unique at generation time -- trusted directly at runtime for
   * hints (Kings-style, NOT the live-recompute style Block Fill/Matching
   * Numbers use, since those don't guarantee uniqueness and this must).
   */
  solutionMask: boolean[][];
}
