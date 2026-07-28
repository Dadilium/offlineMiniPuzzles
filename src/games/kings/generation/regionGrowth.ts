import type { RNG } from './rng';

export type RegionStyle = 'uniform' | 'directional';

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

function frontierFor(n: number, regions: number[][], rid: number): Cell[] {
  const seen = new Set<string>();
  const out: Cell[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (regions[r][c] !== rid) continue;
      for (const [dr, dc] of DIRS) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || rr >= n || cc < 0 || cc >= n) continue;
        if (regions[rr][cc] !== -1) continue;
        const key = `${rr},${cc}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ r: rr, c: cc });
        }
      }
    }
  }
  return out;
}

/** Among a region's frontier, picks the cell that best continues in `dir`
 * relative to the region's own existing cells -- biases growth to be
 * elongated/snake-like instead of a uniform blob. Ties broken randomly. */
function directionalPick(n: number, regions: number[][], rid: number, frontier: Cell[], dir: [number, number], rng: RNG): Cell {
  const [pdr, pdc] = dir;
  let best: Cell[] = [];
  let bestScore = -Infinity;
  for (const cand of frontier) {
    let score = 0;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (regions[r][c] !== rid) continue;
        score += (cand.r - r) * pdr + (cand.c - c) * pdc;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = [cand];
    } else if (score === bestScore) {
      best.push(cand);
    }
  }
  return best[Math.floor(rng() * best.length)];
}

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
  const regions: number[][] = Array.from({ length: n }, () => Array(n).fill(-1));

  const seeds = shuffledCells(n, rng).slice(0, n);
  seeds.forEach((cell, rid) => {
    regions[cell.r][cell.c] = rid;
  });

  const preferredDir: Array<[number, number]> = seeds.map(() => DIRS[Math.floor(rng() * DIRS.length)]);

  let remaining = n * n - n;

  while (remaining > 0) {
    let progressed = false;
    for (let rid = 0; rid < n; rid++) {
      if (remaining === 0) break;
      const frontier = frontierFor(n, regions, rid);
      if (frontier.length === 0) continue;

      const pick =
        style === 'directional' && frontier.length > 1
          ? directionalPick(n, regions, rid, frontier, preferredDir[rid], rng)
          : frontier[Math.floor(rng() * frontier.length)];

      regions[pick.r][pick.c] = rid;
      remaining--;
      progressed = true;
    }
    if (!progressed) return null;
  }

  return regions;
}
