import type { KingsLevel } from '../types';
import type { RNG } from './rng';
import { solveKings } from './solver';

const DIRS: Array<[number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

/** A move never shrinks a region below this -- a 1-cell region hands the
 * player a free king, which would undercut the difficulty repair is for. */
const MIN_REGION_SIZE = 2;

/** Pure: whether region `rid` stays orthogonally connected once `(skipR, skipC)` leaves it. */
function staysConnectedWithout(regions: number[][], rid: number, skipR: number, skipC: number): boolean {
  const n = regions.length;
  const cells: Array<[number, number]> = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (regions[r][c] === rid && (r !== skipR || c !== skipC)) cells.push([r, c]);
  if (cells.length < MIN_REGION_SIZE) return false;
  const seen = new Set<number>([cells[0][0] * n + cells[0][1]]);
  const stack = [cells[0]];
  while (stack.length > 0) {
    const [r, c] = stack.pop()!;
    for (const [dr, dc] of DIRS) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr < 0 || rr >= n || cc < 0 || cc >= n) continue;
      if (rr === skipR && cc === skipC) continue;
      if (regions[rr][cc] !== rid || seen.has(rr * n + cc)) continue;
      seen.add(rr * n + cc);
      stack.push([rr, cc]);
    }
  }
  return seen.size === cells.length;
}

function shuffle<T>(items: T[], rng: RNG): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Turns a planted layout (one known-valid king set, `kingCols[r]` per row)
 * into a uniquely-solvable one by local repair: while a second solution
 * exists, take one of its kings that isn't a planted king and hand that cell
 * to an orthogonally adjacent region. The alternative solution then has two
 * kings in the receiving region, so it's gone; the planted solution is
 * untouched (only non-king cells ever move, and every region keeps its
 * king). Regions stay contiguous and at least `MIN_REGION_SIZE` cells -- a
 * move that would split or over-shrink the donor region is never made.
 * Returns the repaired layout, or null if it couldn't reach uniqueness
 * within `maxSteps` (caller just draws a fresh layout).
 */
export function repairToUnique(regions: number[][], kingCols: number[], rng: RNG, maxSteps: number): number[][] | null {
  const n = regions.length;
  const grid = regions.map((row) => row.slice());
  const isPlantedKing = (r: number, c: number) => kingCols[r] === c;

  for (let step = 0; step <= maxSteps; step++) {
    const level: KingsLevel = { n, regions: grid, solution: [] };
    const solutions = solveKings(level, 2);
    if (solutions.length === 1) return grid;
    if (solutions.length === 0 || step === maxSteps) return null;

    const alt = solutions.find((s) => s.positions.some((p) => !isPlantedKing(p.r, p.c)));
    if (!alt) return null;

    let moved = false;
    for (const { r, c } of shuffle(alt.positions.filter((p) => !isPlantedKing(p.r, p.c)), rng)) {
      const donor = grid[r][c];
      if (!staysConnectedWithout(grid, donor, r, c)) continue;
      const receivers = new Set<number>();
      for (const [dr, dc] of DIRS) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr >= 0 && rr < n && cc >= 0 && cc < n && grid[rr][cc] !== donor) receivers.add(grid[rr][cc]);
      }
      if (receivers.size === 0) continue;
      const options = [...receivers];
      grid[r][c] = options[Math.floor(rng() * options.length)];
      moved = true;
      break;
    }
    if (!moved) return null;
  }
  return null;
}
