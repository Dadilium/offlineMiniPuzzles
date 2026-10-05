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

/** Whether the arrow points back across its own body -- legal (it slides along itself) but reads as a self-collision, so generation never builds one. */
export function aimsAtItself(level: ArrowsLevel, arrow: Arrow): boolean {
  const ray = rayCells(level.rows, level.cols, arrow.path[arrow.path.length - 1], headDirection(arrow, level.cols));
  return ray.some((cell) => arrow.path.includes(cell));
}

/** Arrow covering (r, c), or -1. */
export function arrowAtCell(level: ArrowsLevel, owner: Int32Array, r: number, c: number): number {
  if (!inBounds(level.rows, level.cols, r, c)) return EMPTY;
  return owner[toCellIndex(r, c, level.cols)];
}

/** How far the drawn head's tip pokes past the head cell's center, in cells. */
export const HEAD_TIP = 0.38;

/** Lines are a cell apart, so a cell's own line is never further than this from any point inside it. */
const TAP_REACH = 0.75;
/** Near-ties between two lines go to the arrow whose cell the finger is actually in. */
const OWN_CELL_BIAS = 0.1;

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax;
  const vy = by - ay;
  const lengthSq = vx * vx + vy * vy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / lengthSq));
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
}

/** Distance, in cells, from (x, y) to the arrow as drawn: its body line plus the head's tip. */
export function distanceToArrow(arrow: Arrow, cols: number, x: number, y: number): number {
  const centers = arrow.path.map((cell) => {
    const { r, c } = toRowCol(cell, cols);
    return { x: c + 0.5, y: r + 0.5 };
  });
  const head = centers[centers.length - 1];
  const dir = headDirection(arrow, cols);
  const tip = { x: head.x + dir.dc * HEAD_TIP, y: head.y + dir.dr * HEAD_TIP };
  const points = [...centers, tip];

  let best = Number.POSITIVE_INFINITY;
  for (let i = 1; i < points.length; i++) {
    best = Math.min(best, distanceToSegment(x, y, points[i - 1].x, points[i - 1].y, points[i].x, points[i].y));
  }
  return best;
}

/**
 * Resolves a tap at fractional board coordinates (in cell units) to the
 * arrow whose drawn line is nearest the fingertip, within `TAP_REACH`.
 * `busy` arrows are mid-animation: a tap on one -- including an exiting
 * arrow whose cells are already cleared but which is still flying across
 * them on screen -- is swallowed rather than handed to a neighbor.
 */
export function arrowNearPoint(level: ArrowsLevel, owner: Int32Array, x: number, y: number, busy: ReadonlySet<number> = new Set()): number {
  const r = Math.floor(y);
  const c = Math.floor(x);
  if (inBounds(level.rows, level.cols, r, c)) {
    const cell = toCellIndex(r, c, level.cols);
    for (const id of busy) {
      if (level.arrows[id]?.path.includes(cell)) return EMPTY;
    }
  }
  const direct = arrowAtCell(level, owner, r, c);

  let best = EMPTY;
  let bestDist = TAP_REACH;
  const seen = new Set<number>();
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const id = arrowAtCell(level, owner, r + dr, c + dc);
      if (id === EMPTY || busy.has(id) || seen.has(id)) continue;
      seen.add(id);
      const dist = distanceToArrow(level.arrows[id], level.cols, x, y) - (id === direct ? OWN_CELL_BIAS : 0);
      if (dist <= bestDist) {
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

// ---- Combo streak --------------------------------------------------------

export interface ComboState {
  /** Correct launches in a row, each within `COMBO_WINDOW_MS` of the last. */
  count: number;
  lastAt: number;
}

export const COMBO_IDLE: ComboState = { count: 0, lastAt: 0 };
export const COMBO_WINDOW_MS = 1100;
/** Streak length from which exiting arrows leave a sparkle trail. */
export const COMBO_SPARKLE_MIN = 3;
/** Streak length from which the trail gets denser. */
const COMBO_BURST_MIN = 6;

/** Pure streak reducer: a quick follow-up exit extends it, a slow one restarts it, a bump breaks it. */
export function nextCombo(prev: ComboState, event: 'exit' | 'bump', now: number): ComboState {
  if (event === 'bump') return COMBO_IDLE;
  const quick = prev.count > 0 && now - prev.lastAt <= COMBO_WINDOW_MS;
  return { count: quick ? prev.count + 1 : 1, lastAt: now };
}

/** Sparkles trailing an exit at this streak length -- 0 below the threshold. */
export function sparkleCountFor(combo: number): number {
  if (combo >= COMBO_BURST_MIN) return 10;
  return combo >= COMBO_SPARKLE_MIN ? 6 : 0;
}
