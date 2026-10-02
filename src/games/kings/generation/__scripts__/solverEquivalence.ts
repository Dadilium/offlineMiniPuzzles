/**
 * Cross-checks `solveKings` against the original row-by-row reference
 * solver on random region layouts -- same solution count (up to the cap)
 * and, for unique boards, the identical solution. Kept so any future
 * solver optimisation can be re-verified before it ships.
 *
 * Run with: npx tsx src/games/kings/generation/__scripts__/solverEquivalence.ts
 */
import type { KingsLevel } from '../../types';
import { generateRegions, type RegionStyle } from '../regionGrowth';
import { mulberry32 } from '../rng';
import { solveKings } from '../solver';

/** The pre-optimisation solver, verbatim in behaviour: plain row-by-row backtracking. */
function referenceSolve(level: KingsLevel, cap: number): Array<Array<{ r: number; c: number }>> {
  const n = level.n;
  const solutions: Array<Array<{ r: number; c: number }>> = [];
  const usedCols = new Set<number>();
  const usedRegions = new Set<number>();
  const placed: Array<{ r: number; c: number }> = [];
  const touches = (r: number, c: number) => placed.some((p) => Math.abs(p.r - r) <= 1 && Math.abs(p.c - c) <= 1);

  function backtrack(row: number): void {
    if (solutions.length >= cap) return;
    if (row === n) {
      solutions.push(placed.slice());
      return;
    }
    for (let c = 0; c < n; c++) {
      const region = level.regions[row][c];
      if (usedCols.has(c) || usedRegions.has(region) || touches(row, c)) continue;
      usedCols.add(c);
      usedRegions.add(region);
      placed.push({ r: row, c });
      backtrack(row + 1);
      placed.pop();
      usedRegions.delete(region);
      usedCols.delete(c);
      if (solutions.length >= cap) return;
    }
  }

  backtrack(0);
  return solutions;
}

const STYLES: RegionStyle[] = ['uniform', 'directional', 'thin', 'jagged'];
const BOARDS_PER_SIZE = 4000;

let mismatches = 0;
for (const n of [5, 6, 7, 8, 9]) {
  const rng = mulberry32(0x5eed + n);
  let unique = 0;
  let refMs = 0;
  let newMs = 0;
  for (let i = 0; i < BOARDS_PER_SIZE; i++) {
    const regions = generateRegions(n, rng, STYLES[i % STYLES.length]);
    if (!regions) continue;
    const level: KingsLevel = { n, regions, solution: [] };
    for (const cap of [1, 2]) {
      let t = Date.now();
      const expected = referenceSolve(level, cap);
      refMs += Date.now() - t;
      t = Date.now();
      const actual = solveKings(level, cap);
      newMs += Date.now() - t;

      const sameCount = expected.length === actual.length;
      const sameUnique =
        cap !== 2 || expected.length !== 1 || JSON.stringify(expected[0]) === JSON.stringify(actual[0].positions);
      if (cap === 2 && expected.length === 1) unique++;
      if (!sameCount || !sameUnique) {
        mismatches++;
        if (mismatches <= 5) console.log(`  MISMATCH n=${n} board ${i} cap=${cap}: ref ${expected.length}, new ${actual.length}`);
      }
    }
  }
  console.log(`  n=${n}: ${BOARDS_PER_SIZE} boards, ${unique} unique, reference ${refMs}ms vs new ${newMs}ms`);
}

console.log(mismatches === 0 ? '\nAll boards agree.' : `\n${mismatches} mismatches`);
if (mismatches > 0) throw new Error(`${mismatches} solver mismatches`);
