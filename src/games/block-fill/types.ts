export interface Cell {
  r: number;
  c: number;
}

export interface BlockFillLevel {
  title?: string;
  instructions?: string;
  rows: number;
  cols: number;
  /** true = fillable, false = obstacle. fillable[row][col]. */
  fillable: boolean[][];
  /** Must be a fillable cell. The end point is intentionally not stored/shown separately -- it's just wherever solutionPath ends. */
  start: Cell;
  /**
   * Generation-time proof: the unique Hamiltonian path over fillable cells,
   * starting at `start`. Trusted directly at runtime for hints, since
   * uniqueness is verified before a level ships (see generation/solver.ts).
   */
  solutionPath: Cell[];
}
