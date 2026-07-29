import type { ColorSortLevel } from '../types';
import type { DifficultyTierKey } from './difficulty';

/**
 * One certified board per difficulty tier, for `createLevelForIndexRobust`'s
 * final fallback stage. Generated via generation/__scripts__/sweep.ts and
 * independently re-verified with a 2,000,000-state budget before being
 * pasted here -- deliberately hardcoded rather than generated on the spot,
 * so the last-resort path can never itself fail or block. Per-tier (not one
 * universal easy board) so a player deep in a hard tier is never silently
 * handed an easy one -- see CLAUDE.md's "never fall back to a lesser
 * solution" rule.
 */
export const SAFE_BOARDS: Record<DifficultyTierKey, ColorSortLevel> = {
  starter: {
    capacity: 4,
    colors: 4,
    tubes: [
      [0, 1, 3, 0],
      [2, 1, 2, 3],
      [2, 2, 0, 3],
      [3, 0, 1, 1],
      [],
      [],
    ],
    parMoves: 12,
  },
  growing: {
    capacity: 4,
    colors: 6,
    tubes: [
      [3, 4, 2, 5],
      [3, 5, 1, 3],
      [1, 5, 3, 4],
      [0, 4, 0, 2],
      [4, 2, 1, 5],
      [1, 0, 0, 2],
      [],
      [],
    ],
    parMoves: 19,
  },
  skilled: {
    capacity: 4,
    colors: 7,
    tubes: [
      [4, 3, 1, 1],
      [4, 0, 3, 4],
      [1, 5, 2, 1],
      [3, 2, 5, 2],
      [0, 0, 6, 0],
      [5, 6, 6, 4],
      [2, 3, 5, 6],
      [],
      [],
    ],
    parMoves: 20,
  },
  expert: {
    capacity: 4,
    colors: 9,
    tubes: [
      [4, 3, 4, 8],
      [3, 0, 3, 2],
      [0, 5, 0, 2],
      [6, 4, 1, 3],
      [6, 7, 8, 2],
      [1, 6, 7, 2],
      [7, 1, 8, 5],
      [7, 4, 0, 8],
      [5, 6, 1, 5],
      [],
    ],
    parMoves: 29,
  },
};
