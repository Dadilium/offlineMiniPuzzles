import type { DifficultyTier } from '../../state/difficultyTiers';

/** Flat row-major cell index (`r * cols + c`) -- kept as a single number
 * rather than `{r, c}` so a big Expert board's paths stay compact once
 * persisted. Convert with `toRowCol` / `toCellIndex` in engine.ts. */
export type CellIndex = number;

export interface Arrow {
  /** Equals this arrow's index in `ArrowsLevel.arrows`. */
  id: number;
  /** Ordered tail -> head, >= 2 orthogonally adjacent cells, no repeats. The
   * arrow points along its last segment (path[n-2] -> path[n-1]). */
  path: CellIndex[];
}

export interface ArrowsLevel {
  rows: number;
  cols: number;
  /** Removal order: arrow `i`'s exit ray only crosses arrows `< i`, so
   * launching them in id order always clears the board. Every cell of the
   * board belongs to exactly one arrow -- no empty cells. */
  arrows: Arrow[];
  /** Tier the board was generated at -- shown as the level's eyebrow. */
  tier: DifficultyTier;
}

export interface ArrowsPlayerState {
  /** Arrow ids already launched off the board. */
  removed: number[];
  livesLeft: number;
}

export interface Vec {
  dr: number;
  dc: number;
}

/**
 * What happens when an arrow is tapped. `clearCells` is how many empty cells
 * lie straight ahead of its head before the board edge (`exit`) or before
 * the first arrow in the way (`blocked`) -- the board animates exactly that
 * distance.
 */
export type LaunchOutcome =
  | { kind: 'exit'; arrowId: number; clearCells: number }
  | { kind: 'blocked'; arrowId: number; blockerId: number; clearCells: number };
