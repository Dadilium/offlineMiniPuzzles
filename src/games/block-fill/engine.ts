// Pure game-logic functions for Block Fill. No React/RN dependencies in this
// file on purpose (same convention as Kings/Matching Numbers) -- reuses
// generation/solver.ts's backtracking search both to build levels and, here,
// to answer "is the player's live path still completable" without ever
// trusting the level's solutionPath certificate once the player has
// diverged from it (same reasoning as Matching Numbers' findLegalMove).
import { countFillable, solveBlockFill } from './generation/solver';
import type { BlockFillLevel, Cell } from './types';

function sameCell(a: Cell, b: Cell): boolean {
  return a.r === b.r && a.c === b.c;
}

function isAdjacent(a: Cell, b: Cell): boolean {
  return (a.r === b.r && Math.abs(a.c - b.c) === 1) || (a.c === b.c && Math.abs(a.r - b.r) === 1);
}

/** Legal iff `next` is orthogonally adjacent to the path's tip, fillable, and not already colored. Returns the extended path, or null if illegal. */
export function extendPath(level: BlockFillLevel, path: Cell[], next: Cell): Cell[] | null {
  const tip = path[path.length - 1];
  if (!tip || !isAdjacent(tip, next)) return null;
  if (!level.fillable[next.r]?.[next.c]) return null;
  if (path.some((cell) => sameCell(cell, next))) return null;
  return [...path, next];
}

/** If `cell` is on the path, truncates back to end at it (uncoloring everything after) -- powers touching an earlier trail point to rewind. Returns null if `cell` isn't on the path. */
export function rewindTo(path: Cell[], cell: Cell): Cell[] | null {
  const index = path.findIndex((p) => sameCell(p, cell));
  if (index === -1) return null;
  return path.slice(0, index + 1);
}

export function computeWin(level: BlockFillLevel, path: Cell[]): boolean {
  return path.length === countFillable(level.fillable);
}

/**
 * Live search from the player's current path for a completion (cap=1) --
 * returns the next cell to reveal as a hint, or null if no completion exists
 * from here (the path has wandered into a dead end and needs a rewind, not
 * a hint).
 */
export function findHintCell(level: BlockFillLevel, path: Cell[]): Cell | null {
  if (computeWin(level, path)) return null;
  const solutions = solveBlockFill(level, 1, path);
  if (solutions.length === 0) return null;
  return solutions[0].path[path.length];
}

/** True once the live path can no longer reach a full completion -- the UI-level "you'll need to rewind" signal (never a loss, per spec). */
export function isStuck(level: BlockFillLevel, path: Cell[]): boolean {
  return !computeWin(level, path) && findHintCell(level, path) === null;
}
