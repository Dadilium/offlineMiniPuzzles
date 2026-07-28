// Pure game-logic functions ported from relay-app-prototype_1.html, unchanged
// behavior: Bresenham line-of-sight, BFS-style connectivity flood per color,
// and jamming detection. No React/RN dependencies in this file on purpose —
// keeps it trivially unit-testable and reusable (e.g. by a future level
// solver/generator per the design doc's "Lever 2").
import { GRID_COLS, GRID_ROWS } from './levels';
import type { ConnectivityNode, ConnectivityResult, MirrorOrientation, Point, PlacedRelay, RelayKind, RelayLevel, RelayMirror, SignalColor } from './types';

export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function losClear(a: Point, b: Point, walls: Point[]): boolean {
  let x0 = a.x;
  let y0 = a.y;
  const x1 = b.x;
  const y1 = b.y;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  const pts: Point[] = [];
  let guard = 0;
  while (!(x === x1 && y === y1) && guard < 200) {
    pts.push({ x, y });
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
    guard++;
  }
  pts.push({ x: x1, y: y1 });
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    if (walls.some((w) => w.x === p.x && w.y === p.y)) return false;
  }
  return true;
}

export function isWall(x: number, y: number, level: RelayLevel): boolean {
  return level.walls.some((w) => w.x === x && w.y === y);
}

export function isFixed(x: number, y: number, level: RelayLevel): boolean {
  return level.sources.some((s) => s.x === x && s.y === y) || level.receivers.some((r) => r.x === x && r.y === y);
}

export function isMirror(x: number, y: number, level: RelayLevel): RelayMirror | undefined {
  return (level.mirrors ?? []).find((m) => m.x === x && m.y === y);
}

/**
 * True for any cell occupied by fixed physical terrain -- a wall or a
 * mirror -- as opposed to a source/receiver (see `isFixed`). Callers that
 * need "is this cell off-limits to a player-placed relay because of the
 * board itself" should compose through this rather than re-deriving
 * `isWall(...) || isMirror(...)` at each call site: that pairing used to be
 * hand-rolled in a couple of places and easy to leave incomplete once a
 * level started combining walls with mirrors.
 */
export function isTerrain(x: number, y: number, level: RelayLevel): boolean {
  return isWall(x, y, level) || isMirror(x, y, level) !== undefined;
}

// --- Mirror relays -----------------------------------------------------
// A new terrain type alongside walls. Mirrors are opaque to the plain
// omnidirectional range+LOS check below (a panel blocks a generic sightline
// same as a wall would), but a beam travelling in a cardinal direction
// (N/E/S/W) that lands exactly on one bends 90 degrees for free and keeps
// travelling on the new heading. This gives mirrors a dual role: an obstacle
// you may have to route around, and a tool that can stretch a hop around a
// corner for less range than an ordinary bend via a second relay would cost.
export type Direction = 'N' | 'E' | 'S' | 'W';

export const CARDINAL_DIRECTIONS: Direction[] = ['N', 'E', 'S', 'W'];

const DIR_VECTORS: Record<Direction, Point> = {
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
};

const MIRROR_REFLECT: Record<MirrorOrientation, Record<Direction, Direction>> = {
  fwd: { N: 'E', E: 'N', S: 'W', W: 'S' }, // "/" -- swaps N<->E and S<->W
  back: { N: 'W', W: 'N', S: 'E', E: 'S' }, // "\" -- swaps N<->W and S<->E
};

export interface BeamPoint extends Point {
  /** Grid steps travelled from the emitting node to reach this point. */
  d: number;
}

function blockingPoints(level: RelayLevel): Point[] {
  return level.walls.concat(level.mirrors ?? []);
}

/**
 * Traces a beam from `start` heading `dir`, bending 90 degrees off any
 * mirror tile it lands on, until it exits the grid, hits a wall, or its
 * travelled distance reaches `range`. Returns every point visited (including
 * the start, at d=0) so callers can both check "did this reach cell X" and
 * render the bent polyline.
 */
export function traceCardinalBeam(start: Point, dir: Direction, range: number, level: RelayLevel): BeamPoint[] {
  let heading = dir;
  let x = start.x;
  let y = start.y;
  let d = 0;
  const pts: BeamPoint[] = [{ x, y, d: 0 }];
  while (d < range) {
    const v = DIR_VECTORS[heading];
    const nx = x + v.x;
    const ny = y + v.y;
    if (nx < 0 || nx >= GRID_COLS || ny < 0 || ny >= GRID_ROWS) break;
    if (isWall(nx, ny, level)) break;
    x = nx;
    y = ny;
    d += 1;
    pts.push({ x, y, d });
    const mirror = isMirror(x, y, level);
    if (mirror) heading = MIRROR_REFLECT[mirror.orientation][heading];
  }
  return pts;
}

/** Tries all 4 cardinal directions from `a`; returns the bent path to `target` (truncated at the hit) if any direction reaches it within range. */
export function traceBounceTo(a: { x: number; y: number; range: number }, target: Point, level: RelayLevel): Point[] | null {
  for (const dir of CARDINAL_DIRECTIONS) {
    const pts = traceCardinalBeam(a, dir, a.range, level);
    const hitIdx = pts.findIndex((p) => p.d > 0 && p.x === target.x && p.y === target.y);
    if (hitIdx >= 0) return pts.slice(0, hitIdx + 1);
  }
  return null;
}

export interface ReachResult {
  reached: boolean;
  /** Set when the connection was via a mirror bounce rather than a plain straight hop. */
  bouncePath?: Point[];
}

/**
 * Single source of truth for "can node `a` reach point `b`". `kind` gates
 * which capability `a` itself has: `'circle'` only tries the omnidirectional
 * range+LOS check, `'beam'` only tries the cardinal mirror-bounce check,
 * and `undefined` (the fixed source node, or a relay placed before the
 * circle/beam mechanic shipped) tries the plain check first and falls back
 * to a bounce -- the game's original, unrestricted behavior.
 */
export function canReach(a: { x: number; y: number; range: number }, b: Point, level: RelayLevel, kind?: RelayKind): ReachResult {
  if (kind !== 'beam' && dist(a, b) <= a.range && losClear(a, b, blockingPoints(level))) {
    return { reached: true };
  }
  if (kind !== 'circle') {
    const bouncePath = traceBounceTo(a, b, level);
    if (bouncePath) return { reached: true, bouncePath };
  }
  return { reached: false };
}

export function computeJammed(level: RelayLevel, relays: PlacedRelay[]): Set<number> {
  const jammed = new Set<number>();
  for (let i = 0; i < relays.length; i++) {
    for (let j = 0; j < relays.length; j++) {
      if (i !== j && relays[i].color !== relays[j].color) {
        if (dist(relays[i], relays[j]) < level.interferenceDistance) {
          jammed.add(i);
          jammed.add(j);
        }
      }
    }
  }
  return jammed;
}

export function computeColorConnectivity(
  color: SignalColor,
  level: RelayLevel,
  relays: PlacedRelay[],
  jammed: Set<number>
): ConnectivityResult {
  const source = level.sources.find((s) => s.color === color)!;
  const relayNodes = relays
    .map((r, idx) => ({ x: r.x, y: r.y, color: r.color, relayIdx: idx, kind: r.kind }))
    .filter((r) => r.color === color && !jammed.has(r.relayIdx));
  const sourceNode: ConnectivityNode = { x: source.x, y: source.y, range: source.range, relayIdx: -1, kind: undefined };
  const nodes: ConnectivityNode[] = [sourceNode].concat(
    relayNodes.map((r) => ({ x: r.x, y: r.y, range: level.relayRange, relayIdx: r.relayIdx, kind: r.kind }))
  );
  const n = nodes.length;
  const connected = new Array(n).fill(false);
  connected[0] = true;
  const parent = new Array(n).fill(-1);
  const bouncePaths: Record<number, Point[]> = {};
  let changed = true;
  while (changed) {
    changed = false;
    for (let a = 0; a < n; a++) {
      if (!connected[a]) continue;
      for (let b = 0; b < n; b++) {
        if (connected[b]) continue;
        const reach = canReach(nodes[a], nodes[b], level, nodes[a].kind);
        if (reach.reached) {
          connected[b] = true;
          parent[b] = a;
          if (reach.bouncePath) bouncePaths[b] = reach.bouncePath;
          changed = true;
        }
      }
    }
  }
  const receiver = level.receivers.find((r) => r.color === color)!;
  let receiverParent = -1;
  let receiverBouncePath: Point[] | undefined;
  for (let i = 0; i < n; i++) {
    if (!connected[i]) continue;
    const reach = canReach(nodes[i], receiver, level, nodes[i].kind);
    if (reach.reached) {
      receiverParent = i;
      receiverBouncePath = reach.bouncePath;
      break;
    }
  }
  return {
    nodes,
    connected,
    parent,
    bouncePaths,
    receiverReached: receiverParent >= 0,
    receiverParent,
    receiverBouncePath,
    receiver,
  };
}

interface HintNode {
  x: number;
  y: number;
  range: number;
  kind: RelayKind | undefined;
}

/**
 * Finds the single next relay placement (and which kind it should be) that
 * makes the most progress toward connecting `color`'s source to its
 * receiver, reusing whatever's already correctly placed. Returns null if
 * that color is already connected (nothing to hint) or, defensively, if no
 * path exists at all.
 *
 * This is a multi-source BFS seeded from every node already connected to the
 * source (the source itself plus any non-jammed placed relays reachable from
 * it), expanding over empty grid cells until the receiver comes into range.
 * BFS state is `(x, y, kind)` rather than just `(x, y)`: what a not-yet-placed
 * relay can reach onward depends on which kind it ends up being, and a cell
 * may only pan out under one of the two hypotheses -- so every newly
 * discovered candidate is explored as both a 'circle' and a 'beam' hypothesis
 * (seeds keep their real, already-fixed kind). The 'beam' hypothesis is
 * skipped entirely when the level has no mirrors, since beam is strictly
 * weaker than circle there and never a meaningful choice. On a tie (both
 * hypotheses reach the receiver from the same discovery), 'circle' wins
 * (pushed first, so it's dequeued first) -- picking 'beam' when 'circle'
 * would've worked identically would read as an arbitrary hint to a player.
 */
export function findHintCell(
  level: RelayLevel,
  relays: PlacedRelay[],
  color: SignalColor
): { x: number; y: number; kind: RelayKind } | null {
  const jammed = computeJammed(level, relays);
  const conn = computeColorConnectivity(color, level, relays, jammed);
  if (conn.receiverReached) return null;

  const hasMirrors = (level.mirrors ?? []).length > 0;

  const occupied = new Set<string>();
  level.walls.forEach((w) => occupied.add(`${w.x},${w.y}`));
  (level.mirrors ?? []).forEach((m) => occupied.add(`${m.x},${m.y}`));
  level.sources.forEach((s) => occupied.add(`${s.x},${s.y}`));
  level.receivers.forEach((r) => occupied.add(`${r.x},${r.y}`));
  relays.forEach((r) => occupied.add(`${r.x},${r.y}`));

  // A hint must never land close enough to an opposite-color relay to jam it
  // (or itself) -- that could silently break a signal that was already working.
  const opposingRelays = relays.filter((r) => r.color !== color);
  const wouldJam = (p: Point) => opposingRelays.some((r) => dist(p, r) < level.interferenceDistance);

  const receiver = conn.receiver;
  const keyOf = (x: number, y: number, kind: RelayKind | undefined) => `${x},${y},${kind}`;

  const seedCells = new Set<string>();
  const stateByKey = new Map<string, HintNode>();
  const queue: HintNode[] = [];
  conn.nodes.forEach((node, i) => {
    if (!conn.connected[i]) return;
    seedCells.add(`${node.x},${node.y}`);
    const seed: HintNode = { x: node.x, y: node.y, range: node.range, kind: node.kind };
    stateByKey.set(keyOf(seed.x, seed.y, seed.kind), seed);
    queue.push(seed);
  });

  const discovered = new Set<string>();
  const parentOf = new Map<string, string>();

  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    if (canReach(cur, receiver, level, cur.kind).reached) {
      const chain: HintNode[] = [];
      let node: HintNode | undefined = cur;
      while (node && !seedCells.has(`${node.x},${node.y}`)) {
        chain.push(node);
        const parentKey = parentOf.get(keyOf(node.x, node.y, node.kind));
        node = parentKey ? stateByKey.get(parentKey) : undefined;
      }
      chain.reverse();
      const first = chain[0];
      return { x: first.x, y: first.y, kind: first.kind ?? 'circle' };
    }

    for (let x = 0; x < GRID_COLS; x++) {
      for (let y = 0; y < GRID_ROWS; y++) {
        const cellKey = `${x},${y}`;
        if (occupied.has(cellKey) || seedCells.has(cellKey)) continue;
        const candidate = { x, y };
        if (wouldJam(candidate)) continue;
        if (!canReach(cur, candidate, level, cur.kind).reached) continue;
        const kinds: RelayKind[] = hasMirrors ? ['circle', 'beam'] : ['circle'];
        for (const kind of kinds) {
          const key = keyOf(x, y, kind);
          if (discovered.has(key)) continue;
          discovered.add(key);
          const next: HintNode = { x, y, range: level.relayRange, kind };
          stateByKey.set(key, next);
          parentOf.set(key, keyOf(cur.x, cur.y, cur.kind));
          queue.push(next);
        }
      }
    }
  }
  return null;
}
