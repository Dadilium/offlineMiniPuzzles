export type ColorId = number;

/** One tube's stack of units, index 0 = bottom, last = top. */
export type Tube = ColorId[];

export interface ColorSortLevel {
  title?: string;
  instructions?: string;
  capacity: number;
  /** Number of distinct colors in play -- informational, tubes.length is colors + extraEmpty. */
  colors: number;
  /** Initial arrangement. Never mutated after generation -- see state/useColorSortProgress for the live in-progress copy. */
  tubes: Tube[];
  /**
   * Shortest solve length found by the generator's certifying search (see
   * generation/solver.ts). Shown to the player as a "par" only -- hints and
   * stuck-detection always re-solve live from the player's CURRENT tubes,
   * never trust this once the player has diverged (same reasoning as Block
   * Fill's solutionPath).
   */
  parMoves: number;
}
