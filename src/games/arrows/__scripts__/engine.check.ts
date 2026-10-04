/**
 * Assertion checks for Arrows' launch rules, hit-testing, and the
 * generator's solvability guarantee.
 *
 * Run with: npx tsx src/games/arrows/__scripts__/engine.check.ts
 */
import { analyzeClearing, arrowNearPoint, buildOwnerGrid, freeArrowIds, isCleared, launchOutcome, sanitizeRemoved, toCellIndex } from '../engine';
import { createLevelForIndexRobust, difficultyParams } from '../generation';
import type { ArrowsLevel } from '../types';

function check(name: string, ok: boolean): boolean {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}`);
  return ok;
}

// 3x3 board:
//   arrow 0: (1,0)->(1,1) pointing right, ray = (1,2) -> blocked by arrow 1
//   arrow 1: (0,2)->(1,2) pointing down, ray = (2,2) -> free
//   arrow 2: (2,1)->(2,0) pointing left, ray empty (on the edge) -> free
const cell = (r: number, c: number) => toCellIndex(r, c, 3);
const level: ArrowsLevel = {
  rows: 3,
  cols: 3,
  tier: 'easy',
  arrows: [
    { id: 0, path: [cell(1, 0), cell(1, 1)] },
    { id: 1, path: [cell(0, 2), cell(1, 2)] },
    { id: 2, path: [cell(2, 1), cell(2, 0)] },
  ],
};
const none = new Set<number>();
const owner = buildOwnerGrid(level, none);

const results = [
  check('arrow blocked by the first arrow on its ray', JSON.stringify(launchOutcome(level, owner, 0)) === JSON.stringify({ kind: 'blocked', arrowId: 0, blockerId: 1, clearCells: 0 })),
  check('free arrow reports the clear distance to the edge', JSON.stringify(launchOutcome(level, owner, 1)) === JSON.stringify({ kind: 'exit', arrowId: 1, clearCells: 1 })),
  check('head on the edge pointing out exits with 0 clear cells', launchOutcome(level, owner, 2).kind === 'exit' && launchOutcome(level, owner, 2).clearCells === 0),
  check('removing the blocker frees the arrow behind it', launchOutcome(level, buildOwnerGrid(level, new Set([1])), 0).kind === 'exit'),
  check('freeArrowIds lists only launchable arrows', JSON.stringify(freeArrowIds(level, none)) === JSON.stringify([1, 2])),
  check('analyzeClearing counts dependency rounds', JSON.stringify(analyzeClearing(level)) === JSON.stringify({ rounds: 2, initiallyFree: 2, solvable: true })),
  check('isCleared only once every arrow is gone', !isCleared(level, new Set([0, 1])) && isCleared(level, new Set([0, 1, 2]))),
  check('tap on a cell hits its arrow', arrowNearPoint(level, owner, 0.5, 1.5) === 0),
  check('tap in an empty cell snaps to a nearby arrow', arrowNearPoint(level, buildOwnerGrid(level, new Set([2])), 0.5, 2.2) === 0),
  check('tap far from any arrow hits nothing', arrowNearPoint(level, buildOwnerGrid(level, new Set([0, 1])), 2.5, 0.5) === -1),
  check('sanitizeRemoved drops junk and duplicates', JSON.stringify(sanitizeRemoved(level, [1, 1, 7, -1, 'x', 2])) === JSON.stringify([1, 2])),
];

// Generator guarantee: every tier's boards clear fully, every cell is owned
// exactly once (no empty cells), and every path is a contiguous orthogonal walk.
for (const rating of [20, 50, 70, 90]) {
  let ok = true;
  for (let i = 0; i < 4; i++) {
    const generated = createLevelForIndexRobust(i, rating, []);
    const seen = new Set<number>();
    for (const arrow of generated.arrows) {
      if (arrow.path.length < 2) ok = false;
      arrow.path.forEach((c, k) => {
        if (seen.has(c)) ok = false;
        seen.add(c);
        if (k > 0) {
          const prev = arrow.path[k - 1];
          const dr = Math.abs(Math.floor(c / generated.cols) - Math.floor(prev / generated.cols));
          const dc = Math.abs((c % generated.cols) - (prev % generated.cols));
          if (dr + dc !== 1) ok = false;
        }
      });
    }
    if (seen.size !== generated.rows * generated.cols) ok = false;
    if (!analyzeClearing(generated).solvable || generated.tier !== difficultyParams(rating).tier) ok = false;
  }
  results.push(check(`rating ${rating} boards are well-formed, full, and solvable`, ok));
}

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
if (failed > 0) throw new Error(`${failed} arrows engine check(s) failed`);
