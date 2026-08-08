// Pure game-logic functions for Matching Numbers. No React/RN dependencies in
// this file on purpose -- keeps it trivially unit-testable and reusable by
// generation/boardBuilder.ts (the same canConnect predicate that validates a
// player's tap-pair at runtime is what proves a generated board's backward
// construction is legal, so the two can never drift apart).
import type { Cell, GridValue } from './types';

/** Add Numbers charges per level -- see state/useMatchingNumbersProgress.ts. */
export const MAX_ADD_NUMBERS = 5;

export interface ConnectResult {
  ok: boolean;
  /** true if the path required exactly one 90-degree bend. */
  bend: boolean;
  /** The full path including endpoints (2 cells if straight, 3 if bent). Present only if ok. */
  path?: Cell[];
}

export function makeEmptyGrid(rows: number, cols: number): GridValue[][] {
  return Array.from({ length: rows }, () => Array<GridValue>(cols).fill(null));
}

function inBounds(grid: GridValue[][], r: number, c: number): boolean {
  return r >= 0 && r < grid.length && c >= 0 && c < grid[0].length;
}

/** Strictly-between check along a shared row -- excludes both endpoints. */
function rowClear(grid: GridValue[][], row: number, cA: number, cB: number): boolean {
  const lo = Math.min(cA, cB);
  const hi = Math.max(cA, cB);
  for (let c = lo + 1; c < hi; c++) if (grid[row][c] !== null) return false;
  return true;
}

/** Strictly-between check along a shared column -- excludes both endpoints. */
function colClear(grid: GridValue[][], col: number, rA: number, rB: number): boolean {
  const lo = Math.min(rA, rB);
  const hi = Math.max(rA, rB);
  for (let r = lo + 1; r < hi; r++) if (grid[r][col] !== null) return false;
  return true;
}

/**
 * Pure geometry predicate -- deliberately doesn't look at a/b's own values,
 * only cells strictly between them (or the bend corner). Reused unchanged by
 * generation (boardBuilder.ts), runtime play (attemptMatch below), and the
 * tutorial diagrams.
 */
export function canConnect(grid: GridValue[][], a: Cell, b: Cell): ConnectResult {
  if (!inBounds(grid, a.r, a.c) || !inBounds(grid, b.r, b.c)) return { ok: false, bend: false };
  if (a.r === b.r && a.c === b.c) return { ok: false, bend: false };

  if (a.r === b.r) {
    return rowClear(grid, a.r, a.c, b.c) ? { ok: true, bend: false, path: [a, b] } : { ok: false, bend: false };
  }
  if (a.c === b.c) {
    return colClear(grid, a.c, a.r, b.r) ? { ok: true, bend: false, path: [a, b] } : { ok: false, bend: false };
  }

  // Single 90-degree bend -- two candidate corners. The corner cell itself
  // must be empty (it's a real cell on the path) and both leg segments clear.
  const corner1: Cell = { r: a.r, c: b.c };
  if (grid[corner1.r][corner1.c] === null && rowClear(grid, a.r, a.c, corner1.c) && colClear(grid, corner1.c, corner1.r, b.r)) {
    return { ok: true, bend: true, path: [a, corner1, b] };
  }

  const corner2: Cell = { r: b.r, c: a.c };
  if (grid[corner2.r][corner2.c] === null && colClear(grid, a.c, a.r, corner2.r) && rowClear(grid, corner2.r, corner2.c, b.c)) {
    return { ok: true, bend: true, path: [a, corner2, b] };
  }

  return { ok: false, bend: false };
}

export function valuesMatch(v: number, w: number): boolean {
  return v === w || v + w === 10;
}

export function attemptMatch(grid: GridValue[][], a: Cell, b: Cell): { ok: boolean; path?: Cell[] } {
  const va = grid[a.r][a.c];
  const vb = grid[b.r][b.c];
  if (va === null || vb === null || !valuesMatch(va, vb)) return { ok: false };
  const conn = canConnect(grid, a, b);
  return conn.ok ? { ok: true, path: conn.path } : { ok: false };
}

/** Assumes the caller already validated legality via attemptMatch. */
export function applyMatch(grid: GridValue[][], a: Cell, b: Cell): GridValue[][] {
  const next = grid.map((row) => row.slice());
  next[a.r][a.c] = null;
  next[b.r][b.c] = null;
  return next;
}

export function computeWin(grid: GridValue[][]): boolean {
  return grid.every((row) => row.every((v) => v === null));
}

/**
 * First currently-legal pair found via a live scan of the board -- the same
 * function backs Hint, "is the board stuck" detection, and the fail-overlay
 * trigger. Generation no longer guarantees the whole board is solvable (see
 * generation/boardBuilder.ts), so this genuinely can return null once the
 * player exhausts what the random layout happened to offer.
 */
export function findLegalMove(grid: GridValue[][]): [Cell, Cell] | null {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const nonEmpty: Cell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] !== null) nonEmpty.push({ r, c });
    }
  }
  for (let i = 0; i < nonEmpty.length; i++) {
    for (let j = i + 1; j < nonEmpty.length; j++) {
      if (attemptMatch(grid, nonEmpty[i], nonEmpty[j]).ok) return [nonEmpty[i], nonEmpty[j]];
    }
  }
  return null;
}

export function hasLegalMove(grid: GridValue[][]): boolean {
  return findLegalMove(grid) !== null;
}

/**
 * Row index of the first entirely-cleared row, if any. Removing a fully-null
 * row and shifting everything below it up by one never changes what's
 * connectable -- a fully-null row was never blocking anything to begin with,
 * so every straight-line/bend check gives the same answer before and after,
 * just addressed via shifted (relabeled) row indices. Used to trigger the
 * shift-up collapse animation once a match clears a row out completely.
 */
export function findFullyEmptyRow(grid: GridValue[][]): number | null {
  const idx = grid.findIndex((row) => row.every((v) => v === null));
  return idx === -1 ? null : idx;
}

/** Removes a single row -- e.g. once its shift-up collapse animation has finished -- so every row below it shifts up to fill the gap. */
export function removeRow(grid: GridValue[][], rowIndex: number): GridValue[][] {
  return grid.filter((_, r) => r !== rowIndex);
}

function shuffleValues(values: number[], rng: () => number): number[] {
  const arr = values.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * "Add Numbers": duplicates every currently non-empty value as new row(s) at
 * the bottom of the grid, shuffled so the duplicate isn't just a visual
 * repeat of the existing layout. The board area scrolls (see GameScreen's
 * `boardScrollable`), so there's no screen-fit ceiling on how tall this can
 * grow -- MAX_ADD_NUMBERS charges per level is what bounds how many times a
 * player can compound it. `rng` defaults to Math.random since this is a live
 * player action, not part of seed-reproducible level generation; the
 * parameter exists so tests can inject a deterministic one.
 */
export function applyAddNumbers(grid: GridValue[][], rng: () => number = Math.random): GridValue[][] {
  const cols = grid[0]?.length ?? 0;
  const remaining: number[] = [];
  for (const row of grid) {
    for (const v of row) {
      if (v !== null) remaining.push(v);
    }
  }

  const next = grid.map((row) => row.slice());
  if (remaining.length === 0 || cols === 0) return next;

  const toAdd = shuffleValues(remaining, rng);

  const extraRows = Math.ceil(toAdd.length / cols);
  for (let i = 0; i < extraRows; i++) {
    const row: GridValue[] = Array(cols).fill(null);
    for (let c = 0; c < cols; c++) {
      const idx = i * cols + c;
      if (idx < toAdd.length) row[c] = toAdd[idx];
    }
    next.push(row);
  }
  return next;
}
