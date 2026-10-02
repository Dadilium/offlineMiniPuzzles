import type { RNG } from './rng';

export type RegionStyle = 'uniform' | 'directional' | 'thin' | 'jagged';

interface Cell {
  r: number;
  c: number;
}

const DIRS: Array<[number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

function shuffledCells(n: number, rng: RNG): Cell[] {
  const cells: Cell[] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) cells.push({ r, c });
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  return cells;
}

/** Each region's own cells as row-major indices (r*n+c), kept sorted so
 * iterating them visits cells in the same order a full-grid scan would --
 * walking only a region's cells instead of all n*n keeps the frontier /
 * directional scoring linear in region size while picking identically. */
type RegionCells = number[][];

function insertSorted(list: number[], value: number): void {
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  list.splice(lo, 0, value);
}

/** Unclaimed cells orthogonally adjacent to region `rid`, in row-major order
 * of the region cell they were reached from (then DIRS order), de-duplicated.
 * `seenStamp` is a scratch buffer reused across calls (stamp-based, so it
 * never needs clearing). */
function frontierFor(n: number, regions: number[][], cells: number[], seen: Int32Array, stamp: number): Cell[] {
  const out: Cell[] = [];
  for (const idx of cells) {
    const r = (idx / n) | 0;
    const c = idx - r * n;
    for (const [dr, dc] of DIRS) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr < 0 || rr >= n || cc < 0 || cc >= n) continue;
      if (regions[rr][cc] !== -1) continue;
      const key = rr * n + cc;
      if (seen[key] !== stamp) {
        seen[key] = stamp;
        out.push({ r: rr, c: cc });
      }
    }
  }
  return out;
}

/** Among a region's frontier, picks the cell that best continues in `dir`
 * relative to the region's own existing cells -- biases growth to be
 * elongated/snake-like instead of a uniform blob. Ties broken randomly. */
function directionalPick(n: number, cells: number[], frontier: Cell[], dir: [number, number], rng: RNG): Cell {
  const [pdr, pdc] = dir;
  // sum over region cells of (cand - cell) . dir == size * (cand . dir) - sum(cell . dir)
  let cellDot = 0;
  for (const idx of cells) {
    const r = (idx / n) | 0;
    cellDot += r * pdr + (idx - r * n) * pdc;
  }
  let best: Cell[] = [];
  let bestScore = -Infinity;
  for (const cand of frontier) {
    const score = cells.length * (cand.r * pdr + cand.c * pdc) - cellDot;
    if (score > bestScore) {
      bestScore = score;
      best = [cand];
    } else if (score === bestScore) {
      best.push(cand);
    }
  }
  return best[Math.floor(rng() * best.length)];
}

/** Among a region's frontier, prefers cells that touch the region at only
 * one point -- keeps growth path-like (roughly one cell wide) instead of
 * blobbing out. The same hidden-singles/locked-candidates deduction reads
 * as far less obvious on a thin, meandering region than on a compact one,
 * even though the underlying logic is identical. Falls back to the full
 * frontier when every candidate would blob up (e.g. a tightly boxed-in
 * region with no thin option left). */
function thinPick(n: number, regions: number[][], rid: number, frontier: Cell[], rng: RNG): Cell {
  const attachPoints = (cand: Cell): number => {
    let count = 0;
    for (const [dr, dc] of DIRS) {
      const rr = cand.r + dr;
      const cc = cand.c + dc;
      if (rr >= 0 && rr < n && cc >= 0 && cc < n && regions[rr][cc] === rid) count++;
    }
    return count;
  };
  const thin = frontier.filter((cand) => attachPoints(cand) === 1);
  const pool = thin.length > 0 ? thin : frontier;
  return pool[Math.floor(rng() * pool.length)];
}

/** How often a 'jagged' region re-rolls its preferred growth direction, per
 * claimed cell -- frequent enough to bend into an L/Z shape instead of a
 * straight snake, not so frequent it collapses into plain randomness. */
const JAGGED_TURN_CHANCE = 0.3;

/**
 * Random contiguous region growth: pick `n` seed cells, then grow every
 * region simultaneously and round-robin, one cell per region per round.
 * Always contiguous by construction (standard BFS-race flood fill) -- the
 * game rules don't require contiguity, but every hand-authored level uses
 * connected "realms", and a scattered region would look broken to a player.
 * `style` only changes *which* frontier cell a region claims each turn, so
 * every style shares the same completeness guarantee (every cell claimed
 * exactly once, every region id used) -- a bad style heuristic can only
 * make generation retry more, never produce an invalid partition.
 * Returns null on the (extremely unlikely, since the grid is fully
 * connected) chance a round makes zero progress -- caller just retries with
 * fresh seeds.
 */
export function generateRegions(n: number, rng: RNG, style: RegionStyle = 'uniform'): number[][] | null {
  return growRegions(n, shuffledCells(n, rng).slice(0, n), rng, style);
}

/**
 * Random valid king placement -- one per row and column, no two touching
 * (only consecutive rows can touch, so that's |col difference| > 1).
 * Randomised depth-first search over shuffled columns; always succeeds for
 * n >= 4. Returns the column of the king in each row.
 */
export function randomKingPlacement(n: number, rng: RNG): number[] | null {
  const cols: number[] = [];
  const used = new Array<boolean>(n).fill(false);

  function place(row: number): boolean {
    if (row === n) return true;
    const order = Array.from({ length: n }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    for (const c of order) {
      if (used[c]) continue;
      if (row > 0 && Math.abs(cols[row - 1] - c) <= 1) continue;
      used[c] = true;
      cols.push(c);
      if (place(row + 1)) return true;
      cols.pop();
      used[c] = false;
    }
    return false;
  }

  return place(0) ? cols : null;
}

/**
 * Solution-first ("planted") region growth: places a valid set of kings
 * first, then grows one region out of each king. Every board this produces
 * has at least that one solution by construction, so the generator only has
 * to reject boards with a *second* solution -- instead of the vast majority
 * of random partitions, which have none at all. Same growth (and `style`)
 * as `generateRegions`; the seeds are just the kings instead of random cells.
 * Region ids are shuffled so growth order (round-robin by id) isn't tied to
 * row order. On its own this almost never yields a *unique* board (compact
 * blobs around spread-out kings leave room for alternatives) -- it's the
 * starting point for `repairToUnique`, which also needs `kingCols`.
 */
export function generatePlantedRegions(n: number, rng: RNG, style: RegionStyle = 'uniform'): { regions: number[][]; kingCols: number[] } | null {
  const kingCols = randomKingPlacement(n, rng);
  if (!kingCols) return null;
  const seeds: Cell[] = kingCols.map((c, r) => ({ r, c }));
  for (let i = seeds.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [seeds[i], seeds[j]] = [seeds[j], seeds[i]];
  }
  const regions = growRegions(n, seeds, rng, style);
  return regions ? { regions, kingCols } : null;
}

function growRegions(n: number, seeds: Cell[], rng: RNG, style: RegionStyle): number[][] | null {
  const regions: number[][] = Array.from({ length: n }, () => Array(n).fill(-1));
  const cells: RegionCells = seeds.map((cell) => [cell.r * n + cell.c]);
  seeds.forEach((cell, rid) => {
    regions[cell.r][cell.c] = rid;
  });

  const preferredDir: Array<[number, number]> = seeds.map(() => DIRS[Math.floor(rng() * DIRS.length)]);
  const seen = new Int32Array(n * n);
  let stamp = 0;

  let remaining = n * n - n;

  while (remaining > 0) {
    let progressed = false;
    for (let rid = 0; rid < n; rid++) {
      if (remaining === 0) break;
      const frontier = frontierFor(n, regions, cells[rid], seen, ++stamp);
      if (frontier.length === 0) continue;

      let pick: Cell;
      if (style === 'thin') {
        pick = thinPick(n, regions, rid, frontier, rng);
      } else if (style === 'jagged') {
        if (rng() < JAGGED_TURN_CHANCE) preferredDir[rid] = DIRS[Math.floor(rng() * DIRS.length)];
        pick = frontier.length > 1 ? directionalPick(n, cells[rid], frontier, preferredDir[rid], rng) : frontier[0];
      } else if (style === 'directional' && frontier.length > 1) {
        pick = directionalPick(n, cells[rid], frontier, preferredDir[rid], rng);
      } else {
        pick = frontier[Math.floor(rng() * frontier.length)];
      }

      regions[pick.r][pick.c] = rid;
      insertSorted(cells[rid], pick.r * n + pick.c);
      remaining--;
      progressed = true;
    }
    if (!progressed) return null;
  }

  return regions;
}
