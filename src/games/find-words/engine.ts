// Pure game-logic functions for Find Words. No React/RN dependencies in this
// file on purpose -- keeps it trivially unit-testable, same as every other
// game's engine.ts. Unlike Shikaku, there's no uniqueness-certification
// concept here: a word search has no "unique solution" to verify, so this
// file is deliberately just line geometry + placement matching.
import type { Cell, Direction, FindWordsLevel, Placement } from './types';

export const DIRECTION_VECTORS: Record<Direction, { dr: number; dc: number }> = {
  E: { dr: 0, dc: 1 },
  W: { dr: 0, dc: -1 },
  S: { dr: 1, dc: 0 },
  N: { dr: -1, dc: 0 },
  SE: { dr: 1, dc: 1 },
  NW: { dr: -1, dc: -1 },
};

/** The cell path a placement occupies, index 0 <-> the placement's own (row, col). */
export function placementCells(placement: Placement): Cell[] {
  const { dr, dc } = DIRECTION_VECTORS[placement.direction];
  return Array.from({ length: placement.word.length }, (_, i) => ({
    r: placement.row + dr * i,
    c: placement.col + dc * i,
  }));
}

function cellsEqual(a: Cell, b: Cell): boolean {
  return a.r === b.r && a.c === b.c;
}

function pathsEqual(a: Cell[], b: Cell[]): boolean {
  return a.length === b.length && a.every((cell, i) => cellsEqual(cell, b[i]));
}

/**
 * The 8 compass directions in increasing atan2(dy, dx) order (E=0deg,
 * SE=45deg, S=90deg, ... NE=315deg), matching screen coordinates where y
 * grows downward -- see `lineFromDrag`, which snaps a raw drag onto one of
 * these.
 */
const EIGHT_DIRECTIONS: Array<{ dr: number; dc: number }> = [
  { dr: 0, dc: 1 }, // E
  { dr: 1, dc: 1 }, // SE
  { dr: 1, dc: 0 }, // S
  { dr: 1, dc: -1 }, // SW
  { dr: 0, dc: -1 }, // W
  { dr: -1, dc: -1 }, // NW
  { dr: -1, dc: 0 }, // N
  { dr: -1, dc: 1 }, // NE
];

/**
 * Snaps a free-form drag from `anchor` toward `target` onto the nearest of
 * the 8 compass directions and clips it to the grid bounds, so a drag always
 * reads as one straight line of cells -- never a jagged path. Returns just
 * `[anchor]` if nothing has been dragged yet. Deliberately general (accepts a
 * target along any of the 8 directions, including the NE/SW axis no
 * placement ever uses) rather than restricting the gesture itself --
 * `matchPlacement` is what actually decides a selection is correct, so a
 * drag along an unused axis simply never matches anything.
 */
export function lineFromDrag(anchor: Cell, target: Cell, rows: number, cols: number): Cell[] {
  const dx = target.c - anchor.c;
  const dy = target.r - anchor.r;
  if (dx === 0 && dy === 0) return [anchor];

  const angle = Math.atan2(dy, dx);
  const sector = (Math.round(angle / (Math.PI / 4)) + 8) % 8;
  const { dr, dc } = EIGHT_DIRECTIONS[sector];

  const norm = dr * dr + dc * dc;
  const rawSteps = Math.round((dx * dc + dy * dr) / norm);

  const rowLimit = dr === 1 ? rows - 1 - anchor.r : dr === -1 ? anchor.r : Infinity;
  const colLimit = dc === 1 ? cols - 1 - anchor.c : dc === -1 ? anchor.c : Infinity;
  const steps = Math.max(0, Math.min(rawSteps, rowLimit, colLimit));

  return Array.from({ length: steps + 1 }, (_, i) => ({ r: anchor.r + dr * i, c: anchor.c + dc * i }));
}

/**
 * The index of the first not-yet-found placement whose cell path equals
 * `cells`, read in either direction -- a player can drag a word from either
 * end, regardless of which direction it was stored in (see Direction's
 * comment in types.ts). Returns null if nothing matches, including a
 * single-cell selection (every placement is at least 3 letters).
 */
export function matchPlacement(level: FindWordsLevel, cells: Cell[], foundIndices: number[]): number | null {
  if (cells.length < 2) return null;
  const found = new Set(foundIndices);
  const reversed = cells.slice().reverse();

  for (let i = 0; i < level.placements.length; i++) {
    if (found.has(i)) continue;
    const placed = placementCells(level.placements[i]);
    if (pathsEqual(cells, placed) || pathsEqual(reversed, placed)) return i;
  }
  return null;
}

export function isLevelComplete(foundIndices: number[], level: FindWordsLevel): boolean {
  return foundIndices.length === level.placements.length;
}
