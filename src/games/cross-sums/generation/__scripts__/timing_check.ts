/**
 * Ad-hoc check: what does the solver actually cost per candidate on REAL
 * random inputs (same shape as generateCrossSumsLevel's own candidates), not
 * an adversarially-constructed worst case? Run with:
 * npx tsx src/games/cross-sums/generation/__scripts__/timing_check.ts
 */
import { mulberry32 } from '../rng';
import { solveCrossSums } from '../solver';

function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

const rows = 8;
const cols = 8;
const density = 0.5;
const N = 5000;

const rng = mulberry32(12345);
let maxMs = 0;
let totalMs = 0;
let worstGrid: number[][] | null = null;

for (let i = 0; i < N; i++) {
  const grid: number[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => randInt(rng, 1, 9)));
  const mask: boolean[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => rng() < density));
  const rowTargets = grid.map((row, r) => row.reduce((sum, v, c) => sum + (mask[r][c] ? v : 0), 0));
  const colTargets = Array.from({ length: cols }, (_, c) => grid.reduce((sum, row, r) => sum + (mask[r][c] ? row[c] : 0), 0));

  const start = Date.now();
  solveCrossSums({ rows, cols, grid, rowTargets, colTargets }, 2);
  const elapsed = Date.now() - start;
  totalMs += elapsed;
  if (elapsed > maxMs) {
    maxMs = elapsed;
    worstGrid = grid;
  }
}

console.log(`${N} realistic random 8x8 candidates: total ${totalMs}ms, avg ${(totalMs / N).toFixed(3)}ms, max single solve ${maxMs}ms`);
if (maxMs > 50) console.log('worst grid:', JSON.stringify(worstGrid));
