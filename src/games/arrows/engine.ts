// Pure game-logic functions for Arrows. No React/RN dependencies in this
// file on purpose -- keeps it trivially unit-testable, same as every other
// game's engine.ts.
//
// Movement model: a launched arrow slides head-first along its own body and
// then straight on in the direction it points, like a snake. Its body only
// ever re-traces cells it already owns, so the only cells that can stop it
// are the ones straight ahead of its head (its "ray"), out to the board edge.
import type { Arrow, ArrowsLevel, CellIndex, LaunchOutcome, Vec } from './types';

export const MAX_LIVES = 3;

const EMPTY = -1;

export function toRowCol(cell: CellIndex, cols: number): { r: number; c: number } {
  return { r: Math.floor(cell / cols), c: cell % cols };
}

export function toCellIndex(r: number, c: number, cols: number): CellIndex {
  return r * cols + c;
}

export function inBounds(rows: number, cols: number, r: number, c: number): boolean {
  return r >= 0 && r < rows && c >= 0 && c < cols;
}

/** Unit step the arrow points along -- the direction of its last segment. */
export function headDirection(arrow: Arrow, cols: number): Vec {
  const head = toRowCol(arrow.path[arrow.path.length - 1], cols);
  const neck = toRowCol(arrow.path[arrow.path.length - 2], cols);
  return { dr: head.r - neck.r, dc: head.c - neck.c };
}

/** Cells strictly ahead of `head` along `dir`, nearest first, up to the edge. */
export function rayCells(rows: number, cols: number, head: CellIndex, dir: Vec): CellIndex[] {
  const cells: CellIndex[] = [];
  const start = toRowCol(head, cols);
  let r = start.r + dir.dr;
  let c = start.c + dir.dc;
  while (inBounds(rows, cols, r, c)) {
    cells.push(toCellIndex(r, c, cols));
    r += dir.dr;
    c += dir.dc;
  }
  return cells;
}

/** Arrow id owning each cell (`-1` when empty), ignoring removed arrows. */
export function buildOwnerGrid(level: ArrowsLevel, removed: ReadonlySet<number>): Int32Array {
  const owner = new Int32Array(level.rows * level.cols).fill(EMPTY);
  for (const arrow of level.arrows) {
    if (removed.has(arrow.id)) continue;
    for (const cell of arrow.path) owner[cell] = arrow.id;
  }
  return owner;
}

/** Whether tapping `arrowId` right now flies it off the board or bumps it into another arrow. */
export function launchOutcome(level: ArrowsLevel, owner: Int32Array, arrowId: number): LaunchOutcome {
  const arrow = level.arrows[arrowId];
  const head = arrow.path[arrow.path.length - 1];
  const ray = rayCells(level.rows, level.cols, head, headDirection(arrow, level.cols));
  for (let i = 0; i < ray.length; i++) {
    const blockerId = owner[ray[i]];
    if (blockerId !== EMPTY && blockerId !== arrowId) return { kind: 'blocked', arrowId, blockerId, clearCells: i };
  }
  return { kind: 'exit', arrowId, clearCells: ray.length };
}

/** Ids of every still-present arrow that would fly off if tapped now. */
export function freeArrowIds(level: ArrowsLevel, removed: ReadonlySet<number>): number[] {
  const owner = buildOwnerGrid(level, removed);
  return level.arrows.filter((arrow) => !removed.has(arrow.id) && launchOutcome(level, owner, arrow.id).kind === 'exit').map((arrow) => arrow.id);
}

export function isCleared(level: ArrowsLevel, removed: ReadonlySet<number>): boolean {
  return level.arrows.every((arrow) => removed.has(arrow.id));
}

export interface ClearAnalysis {
  /** Times the "launch everything currently free" sweep has to repeat to
   * clear the board -- the length of the longest dependency chain, the
   * main difficulty signal. */
  rounds: number;
  /** Arrows free before any move -- the fewer, the harder to find a start. */
  initiallyFree: number;
  /** False only if some arrows can never leave (never true for a generated board). */
  solvable: boolean;
}

/**
 * Launching an arrow only ever frees space, never blocks anything, so the
 * greedy "launch every free arrow, repeat" sweep is a complete solver: if it
 * stalls, no order could have cleared the board. That same property is why
 * a hint can safely be any currently-free arrow.
 */
export function analyzeClearing(level: ArrowsLevel): ClearAnalysis {
  const removed = new Set<number>();
  let rounds = 0;
  let initiallyFree = -1;
  while (removed.size < level.arrows.length) {
    const free = freeArrowIds(level, removed);
    if (initiallyFree === -1) initiallyFree = free.length;
    if (free.length === 0) return { rounds, initiallyFree, solvable: false };
    for (const id of free) removed.add(id);
    rounds++;
  }
  return { rounds, initiallyFree: Math.max(0, initiallyFree), solvable: true };
}

/** Arrow covering (r, c), or -1. */
export function arrowAtCell(level: ArrowsLevel, owner: Int32Array, r: number, c: number): number {
  if (!inBounds(level.rows, level.cols, r, c)) return EMPTY;
  return owner[toCellIndex(r, c, level.cols)];
}

/**
 * Resolves a tap at fractional board coordinates (in cell units) to an
 * arrow. Arrows are drawn as thin lines through cell centers, so an exact
 * cell hit is tried first, then the nearest occupied neighbor whose center
 * is within `reach` cells -- forgiving a fingertip landing in an empty
 * cell right beside the line the player was aiming at.
 */
export function arrowNearPoint(level: ArrowsLevel, owner: Int32Array, x: number, y: number, reach = 0.85): number {
  const r = Math.floor(y);
  const c = Math.floor(x);
  const direct = arrowAtCell(level, owner, r, c);
  if (direct !== EMPTY) return direct;

  let best = EMPTY;
  let bestDist = reach;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const id = arrowAtCell(level, owner, r + dr, c + dc);
      if (id === EMPTY) continue;
      const dist = Math.hypot(c + dc + 0.5 - x, r + dr + 0.5 - y);
      if (dist < bestDist) {
        bestDist = dist;
        best = id;
      }
    }
  }
  return best;
}

/** Strips unknown/duplicate ids so a persisted `removed` list can't desync from its level. */
export function sanitizeRemoved(level: ArrowsLevel, raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  for (const id of raw) {
    if (typeof id === 'number' && Number.isInteger(id) && id >= 0 && id < level.arrows.length) seen.add(id);
  }
  return [...seen];
}
