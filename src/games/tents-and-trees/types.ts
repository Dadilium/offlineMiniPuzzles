export interface TentsAndTreesLevel {
  title?: string;
  instructions?: string;
  rows: number;
  cols: number;
  /** Fixed clue cells, never edited. trees[row][col]. */
  trees: boolean[][];
  rowTargets: number[];
  colTargets: number[];
  /**
   * Verified unique at generation time -- trusted directly at runtime for
   * hints (Cross Sums-style), since generation guarantees this is the only
   * tent placement satisfying every row/col target, the adjacency rule, and
   * the tree-tent matching requirement simultaneously.
   */
  solutionTents: boolean[][];
}

export interface Cell {
  r: number;
  c: number;
}
