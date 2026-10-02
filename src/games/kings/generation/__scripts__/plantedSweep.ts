/**
 * Compares 'random' vs 'planted' (planted kings + `repairToUnique`) region construction for Kings at each board
 * size: how often an attempt yields a usable board (unique, guess-free,
 * medium-tier), what that costs, and whether planted boards *look and play*
 * differently -- deduction depth (elimination rounds), region-size spread,
 * and how centred each king sits in its region (a planted king is its
 * region's growth seed, so a strong centring bias would be a visual tell a
 * player could exploit). Prints one sample planted board per size to eyeball.
 *
 * Run with: npx tsx src/games/kings/generation/__scripts__/plantedSweep.ts [--sizes 5,6,7,8,9,10,11] [--seconds 8]
 */
import type { KingsLevel } from '../../types';
import { solveByElimination } from '../eliminationSolver';
import type { RegionConstruction } from '../difficulty';
import { generatePlantedRegions, generateRegions, type RegionStyle } from '../regionGrowth';
import { repairToUnique } from '../uniqueRepair';
import { mulberry32, type RNG } from '../rng';
import { solveKings } from '../solver';

/** Same style mix the live difficulty params use. */
const STYLE_WEIGHTS: Array<[RegionStyle, number]> = [
  ['uniform', 0.3],
  ['directional', 0.25],
  ['thin', 0.25],
  ['jagged', 0.2],
];

function pickStyle(rng: RNG): RegionStyle {
  let x = rng();
  for (const [style, w] of STYLE_WEIGHTS) {
    if (x < w) return style;
    x -= w;
  }
  return 'uniform';
}

interface Hit {
  level: KingsLevel;
  rounds: number;
  tier: 'medium' | 'hard' | 'easy';
}

/** Tiers the generator accepts at this size: easy-only for small boards,
 * medium or harder from n=7 (see `difficultyParams`). */
function acceptedTiers(n: number): Array<Hit['tier']> {
  return n <= 6 ? ['easy'] : ['medium', 'hard'];
}

interface SweepResult {
  attempts: number;
  ms: number;
  unique: number;
  guessy: number;
  /** Unique, guess-free boards whose tier isn't accepted at this size. */
  offTier: number;
  hits: Hit[];
}

function sweep(n: number, construction: RegionConstruction, budgetMs: number): SweepResult {
  const rng = mulberry32(0xbadc0de + n);
  const result: SweepResult = { attempts: 0, ms: 0, unique: 0, guessy: 0, offTier: 0, hits: [] };
  const start = Date.now();
  while (Date.now() - start < budgetMs) {
    result.attempts++;
    const style = pickStyle(rng);
    const planted = construction === 'planted' ? generatePlantedRegions(n, rng, style) : null;
    const regions = planted ? repairToUnique(planted.regions, planted.kingCols, rng, Math.ceil(n * n * 0.5)) : generateRegions(n, rng, style);
    if (!regions) continue;
    const level: KingsLevel = { n, regions, solution: [] };
    const solutions = solveKings(level, 2);
    if (solutions.length !== 1) continue;
    result.unique++;
    level.solution = solutions[0].positions.map((p): [number, number] => [p.r, p.c]);
    const elim = solveByElimination(level);
    if (!elim.solved) {
      result.guessy++;
      continue;
    }
    if (!acceptedTiers(n).includes(elim.tier)) {
      result.offTier++;
      continue;
    }
    result.hits.push({ level, rounds: elim.rounds, tier: elim.tier });
  }
  result.ms = Date.now() - start;
  return result;
}

/** Pure: region sizes of a layout. */
function regionSizes(level: KingsLevel): number[] {
  const sizes = new Array<number>(level.n).fill(0);
  for (const row of level.regions) for (const id of row) sizes[id]++;
  return sizes;
}

/** Pure: mean king->region-centroid distance, normalised by sqrt(region size) -- 0 = dead centre. */
function kingCentering(level: KingsLevel): number {
  const n = level.n;
  const sum = Array.from({ length: n }, () => ({ r: 0, c: 0, k: 0 }));
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const s = sum[level.regions[r][c]];
      s.r += r;
      s.c += c;
      s.k++;
    }
  }
  let total = 0;
  for (const [r, c] of level.solution) {
    const s = sum[level.regions[r][c]];
    total += Math.hypot(r - s.r / s.k, c - s.c / s.k) / Math.sqrt(s.k);
  }
  return total / n;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const fmt = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');

function renderBoard(level: KingsLevel): string {
  const glyphs = 'abcdefghijk';
  const kings = new Set(level.solution.map(([r, c]) => `${r},${c}`));
  return level.regions
    .map((row, r) => '    ' + row.map((id, c) => (kings.has(`${r},${c}`) ? glyphs[id].toUpperCase() : glyphs[id])).join(' '))
    .join('\n');
}

function argValue(name: string): string | undefined {
  const args = (globalThis as unknown as { process?: { argv: string[] } }).process?.argv ?? [];
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

const sizes = (argValue('sizes') ?? '5,6,7,8,9,10,11').split(',').map(Number);
const budgetMs = Number(argValue('seconds') ?? 8) * 1000;

console.log(`\nKings construction sweep -- ${budgetMs / 1000}s per size per method (Node; phones are slower)\n`);
console.log('| n | method | attempts | unique | guessy | off-tier | usable | of which hard | ms per usable | avg rounds | region size min/max | king centring |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
const samples: Array<[number, KingsLevel]> = [];
for (const n of sizes) {
  for (const construction of ['random', 'planted'] as const) {
    const r = sweep(n, construction, budgetMs);
    const sizesPerHit = r.hits.map((h) => regionSizes(h.level));
    const pct = (x: number) => `${((x / r.attempts) * 100).toFixed(2)}%`;
    console.log(
      `| ${n} | ${construction} | ${r.attempts} | ${pct(r.unique)} | ${r.guessy} | ${r.offTier} | ${r.hits.length} | ${r.hits.filter((h) => h.tier === 'hard').length} | ${r.hits.length ? fmt(r.ms / r.hits.length, 1) : '∞'} | ${fmt(mean(r.hits.map((h) => h.rounds)), 1)} | ${fmt(mean(sizesPerHit.map((s) => Math.min(...s))), 1)} / ${fmt(mean(sizesPerHit.map((s) => Math.max(...s))), 1)} | ${fmt(mean(r.hits.map((h) => kingCentering(h.level))))} |`
    );
    if (construction === 'planted' && r.hits.length) samples.push([n, r.hits[0].level]);
  }
}

console.log('\nSample planted boards (letter = region, CAPITAL = king):');
for (const [n, level] of samples) console.log(`\n  n=${n}\n${renderBoard(level)}`);
