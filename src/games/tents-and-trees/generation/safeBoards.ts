import type { TentsAndTreesLevel } from '../types';
import type { DifficultyTierKey } from './difficulty';

/**
 * One certified board per difficulty tier, for `createLevelForIndexRobust`'s
 * final fallback stage. Pulled directly from generation/__scripts__/sweep.ts
 * output (uniqueness already verified by `solveTentsAndTrees` at generation
 * time, and each tree/tent pair unambiguous -- see constructSolvedBoard's
 * pair-placement rules) and hardcoded here -- deliberately, so the
 * last-resort path can never itself fail or block. Per-tier (not one
 * universal easy board) so a player deep in a hard tier is never silently
 * handed an easy one -- see CLAUDE.md's "never fall back to a lesser
 * solution" rule.
 */
export const SAFE_BOARDS: Record<DifficultyTierKey, TentsAndTreesLevel> = {
  starter: {
    rows: 5,
    cols: 5,
    trees: [
      [false, false, false, false, false],
      [false, false, true, false, false],
      [false, true, false, false, true],
      [false, false, false, false, false],
      [false, false, false, false, false],
    ],
    rowTargets: [0, 1, 1, 1, 0],
    colTargets: [1, 0, 0, 1, 1],
    solutionTents: [
      [false, false, false, false, false],
      [false, false, false, true, false],
      [true, false, false, false, false],
      [false, false, false, false, true],
      [false, false, false, false, false],
    ],
  },
  growing: {
    rows: 6,
    cols: 6,
    trees: [
      [false, false, false, true, false, false],
      [false, false, false, true, false, false],
      [false, false, false, true, false, false],
      [false, false, false, false, false, false],
      [false, false, false, false, true, false],
      [true, false, false, false, false, false],
    ],
    rowTargets: [1, 1, 1, 0, 0, 2],
    colTargets: [0, 1, 1, 0, 3, 0],
    solutionTents: [
      [false, false, false, false, true, false],
      [false, false, true, false, false, false],
      [false, false, false, false, true, false],
      [false, false, false, false, false, false],
      [false, false, false, false, false, false],
      [false, true, false, false, true, false],
    ],
  },
  skilled: {
    rows: 7,
    cols: 7,
    trees: [
      [false, false, true, true, false, false, false],
      [true, false, false, false, false, false, false],
      [false, false, false, false, false, false, false],
      [false, false, false, false, false, true, true],
      [false, false, true, false, false, false, false],
      [false, false, false, false, false, false, false],
      [false, false, false, false, true, false, false],
    ],
    rowTargets: [2, 0, 1, 1, 1, 1, 1],
    colTargets: [1, 1, 1, 0, 2, 1, 1],
    solutionTents: [
      [false, true, false, false, true, false, false],
      [false, false, false, false, false, false, false],
      [true, false, false, false, false, false, false],
      [false, false, false, false, true, false, false],
      [false, false, false, false, false, false, true],
      [false, false, true, false, false, false, false],
      [false, false, false, false, false, true, false],
    ],
  },
  expert: {
    rows: 8,
    cols: 8,
    trees: [
      [false, true, false, true, false, false, false, false],
      [false, false, false, false, false, true, false, false],
      [false, true, false, false, false, false, false, true],
      [false, false, false, false, false, false, false, false],
      [false, false, false, true, false, true, true, false],
      [false, false, false, false, true, false, false, false],
      [false, false, false, false, false, false, false, false],
      [true, false, false, true, false, true, false, false],
    ],
    rowTargets: [2, 2, 1, 1, 2, 0, 2, 2],
    colTargets: [3, 0, 2, 1, 1, 2, 1, 2],
    solutionTents: [
      [true, false, false, false, false, true, false, false],
      [false, false, false, true, false, false, false, true],
      [true, false, false, false, false, false, false, false],
      [false, false, false, false, false, true, false, false],
      [false, false, true, false, false, false, false, true],
      [false, false, false, false, false, false, false, false],
      [true, false, false, false, true, false, false, false],
      [false, false, true, false, false, false, true, false],
    ],
  },
};
