import type { ShikakuLevel } from '../types';
import type { DifficultyTierKey } from './difficulty';

/**
 * One certified board per difficulty tier, for `createLevelForIndexRobust`'s
 * final fallback stage. Pulled directly from generation/__scripts__/sweep.ts
 * output at each tier's rating (10/40/60/80) and hardcoded here --
 * uniqueness re-confirmed by a one-off `solveShikaku(level, 2)` check
 * (each returned exactly 1 solution) before being pasted in. Per-tier (not
 * one universal easy board) so a player deep in a hard tier is never
 * silently handed an easy one -- see CLAUDE.md's "never fall back to a
 * lesser solution" rule.
 *
 * Regenerated 2026-07-30 after `generator.ts` started enforcing a hard
 * `MIN_LEAF_AREA` floor of 2 (a value-1 clue has only one possible
 * placement -- the cell itself -- so it's a "useless" clue, not a puzzle
 * element) -- the previous boards here predated that fix and still had
 * several value-1 clues.
 */
export const SAFE_BOARDS: Record<DifficultyTierKey, ShikakuLevel> = {
  starter: {
    rows: 5,
    cols: 6,
    clues: [
      { r: 1, c: 1, value: 4 },
      { r: 2, c: 1, value: 6 },
      { r: 1, c: 5, value: 8 },
      { r: 3, c: 2, value: 4 },
      { r: 4, c: 3, value: 2 },
      { r: 3, c: 4, value: 6 },
    ],
    solutionRects: [
      { r0: 0, c0: 0, r1: 1, c1: 1 },
      { r0: 2, c0: 0, r1: 4, c1: 1 },
      { r0: 0, c0: 2, r1: 1, c1: 5 },
      { r0: 2, c0: 2, r1: 3, c1: 3 },
      { r0: 4, c0: 2, r1: 4, c1: 3 },
      { r0: 2, c0: 4, r1: 4, c1: 5 },
    ],
  },
  growing: {
    rows: 8,
    cols: 8,
    clues: [
      { r: 2, c: 1, value: 9 },
      { r: 1, c: 3, value: 9 },
      { r: 1, c: 6, value: 6 },
      { r: 3, c: 1, value: 4 },
      { r: 4, c: 4, value: 6 },
      { r: 7, c: 2, value: 9 },
      { r: 5, c: 4, value: 6 },
      { r: 4, c: 6, value: 9 },
      { r: 7, c: 5, value: 6 },
    ],
    solutionRects: [
      { r0: 0, c0: 0, r1: 2, c1: 2 },
      { r0: 0, c0: 3, r1: 2, c1: 5 },
      { r0: 0, c0: 6, r1: 2, c1: 7 },
      { r0: 3, c0: 0, r1: 4, c1: 1 },
      { r0: 3, c0: 2, r1: 4, c1: 4 },
      { r0: 5, c0: 0, r1: 7, c1: 2 },
      { r0: 5, c0: 3, r1: 7, c1: 4 },
      { r0: 3, c0: 5, r1: 5, c1: 7 },
      { r0: 6, c0: 5, r1: 7, c1: 7 },
    ],
  },
  skilled: {
    rows: 9,
    cols: 8,
    clues: [
      { r: 0, c: 2, value: 12 },
      { r: 0, c: 4, value: 6 },
      { r: 4, c: 4, value: 12 },
      { r: 0, c: 6, value: 10 },
      { r: 6, c: 0, value: 6 },
      { r: 5, c: 3, value: 10 },
      { r: 7, c: 0, value: 2 },
      { r: 7, c: 1, value: 2 },
      { r: 7, c: 2, value: 12 },
    ],
    solutionRects: [
      { r0: 0, c0: 0, r1: 2, c1: 3 },
      { r0: 0, c0: 4, r1: 2, c1: 5 },
      { r0: 3, c0: 0, r1: 4, c1: 5 },
      { r0: 0, c0: 6, r1: 4, c1: 7 },
      { r0: 5, c0: 0, r1: 6, c1: 2 },
      { r0: 5, c0: 3, r1: 6, c1: 7 },
      { r0: 7, c0: 0, r1: 8, c1: 0 },
      { r0: 7, c0: 1, r1: 8, c1: 1 },
      { r0: 7, c0: 2, r1: 8, c1: 7 },
    ],
  },
  expert: {
    rows: 10,
    cols: 9,
    clues: [
      { r: 0, c: 0, value: 2 },
      { r: 1, c: 0, value: 2 },
      { r: 1, c: 1, value: 2 },
      { r: 3, c: 1, value: 14 },
      { r: 1, c: 2, value: 14 },
      { r: 3, c: 6, value: 12 },
      { r: 5, c: 5, value: 9 },
      { r: 8, c: 3, value: 15 },
      { r: 3, c: 8, value: 8 },
      { r: 5, c: 7, value: 12 },
    ],
    solutionRects: [
      { r0: 0, c0: 0, r1: 0, c1: 1 },
      { r0: 1, c0: 0, r1: 2, c1: 0 },
      { r0: 1, c0: 1, r1: 2, c1: 1 },
      { r0: 3, c0: 0, r1: 9, c1: 1 },
      { r0: 0, c0: 2, r1: 6, c1: 3 },
      { r0: 0, c0: 4, r1: 3, c1: 6 },
      { r0: 4, c0: 4, r1: 6, c1: 6 },
      { r0: 7, c0: 2, r1: 9, c1: 6 },
      { r0: 0, c0: 7, r1: 3, c1: 8 },
      { r0: 4, c0: 7, r1: 9, c1: 8 },
    ],
  },
};
