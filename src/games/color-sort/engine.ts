// Pure game-logic functions for Color Sort. No React/RN dependencies in
// this file on purpose, same convention as every other game's engine.ts.
// pourMove/computeWin are the canonical rule implementations, shared with
// generation/solver.ts (imported, not duplicated) so the player-facing
// rules and the certifying search can never drift apart.
import { computeWin, isTubeFilledSolid, pourMove, solveColorSort, type Move } from './generation/solver';
import type { Tube } from './types';

export { computeWin, isTubeFilledSolid, pourMove };
export type { Move, PourResult } from './generation/solver';

// A single on-demand call per hint tap or stuck-check, not thousands of
// attempts in a generation loop -- safe to give this a larger budget than
// generation's own solverStateBudget tiers.
const RUNTIME_MAX_STATES = 800_000;

/**
 * Live re-solve from the player's CURRENT tubes -- never trusts a
 * precomputed solution once the player has diverged from it, same
 * reasoning as Block Fill's findHintCell. Returns the first move of the
 * shortest path found, or null if no completion exists from here.
 */
export function findBestMove(tubes: Tube[], capacity: number): Move | null {
  if (computeWin(tubes, capacity)) return null;
  const result = solveColorSort(tubes, capacity, { maxStates: RUNTIME_MAX_STATES });
  return result.solvable && result.moves ? result.moves[0] : null;
}

/**
 * True once the live board can no longer reach a win -- the UI-level
 * "you'll need to reset" signal, never a loss. `truncated` (search cut off
 * before exhausting the space) is treated as "unknown, not stuck" -- a
 * false "stuck" here would be a visible bug, not just a wasted search.
 */
export function isStuck(tubes: Tube[], capacity: number): boolean {
  if (computeWin(tubes, capacity)) return false;
  const result = solveColorSort(tubes, capacity, { maxStates: RUNTIME_MAX_STATES });
  return result.solvable === false && !result.truncated;
}
