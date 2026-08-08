/**
 * Smoke test for engine.ts / generation/solver.ts against a real generated
 * level -- checks computeWin, applyHint, and specifically that the win
 * condition is a true tree-tent bijection, not the looser "every tree has
 * some adjacent tent" check that would wrongly accept an unmatchable board.
 * Kept here for future use per CLAUDE.md (not a throwaway).
 *
 * Run with: npx tsx src/games/tents-and-trees/__scripts__/engineSmoke.ts
 */
import { applyHint, computeWin, hasPerfectMatching, makeInitialTents, matchedTreeCells } from '../engine';
import { createLevelForIndex } from '../generation';
import type { TentsAndTreesLevel } from '../types';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAILED: ${message}`);
  console.log(`ok: ${message}`);
}

function orthogonalNeighborCount(grid: boolean[][], r: number, c: number): number {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  let count = 0;
  if (r > 0 && grid[r - 1][c]) count++;
  if (r < rows - 1 && grid[r + 1][c]) count++;
  if (c > 0 && grid[r][c - 1]) count++;
  if (c < cols - 1 && grid[r][c + 1]) count++;
  return count;
}

const result = createLevelForIndex(0, 60, []);
if (!('level' in result)) throw new Error('generation failed');
const level = result.level;
console.log(`level: ${level.rows}x${level.cols}, ${level.rowTargets.reduce((a, b) => a + b, 0)} trees`);

assert(!computeWin(level, makeInitialTents(level.rows, level.cols)), 'an empty board is not a win');
assert(computeWin(level, level.solutionTents), "the generator's certified solution wins");

// Regression check for a real bug caught during playtest: the generator
// used to occasionally place two unrelated tree/tent pairs close enough
// that a tree ended up bordering two tents (or a tent bordering two trees).
// Still a technically valid solution (the win condition only needs *some*
// matching to exist), but it reads as "this looks wrong" on a solved board
// since there's no way to tell which neighbor is the tree's actual match --
// see constructSolvedBoard's pair-placement rules in generation/generator.ts.
assert(
  level.trees.every((row, r) => row.every((isTree, c) => !isTree || orthogonalNeighborCount(level.solutionTents, r, c) <= 1)),
  'no tree borders more than one tent in the certified solution'
);
assert(
  level.solutionTents.every((row, r) => row.every((isTent, c) => !isTent || orthogonalNeighborCount(level.trees, r, c) <= 1)),
  'no tent borders more than one tree in the certified solution'
);

// Replay applyHint from empty and confirm it converges exactly onto the certified solution.
let tents = makeInitialTents(level.rows, level.cols);
let hintCount = 0;
const maxHints = level.rows * level.cols + 1;
while (!computeWin(level, tents) && hintCount < maxHints) {
  const hint = applyHint(level, tents);
  if (!hint) break;
  tents = hint.tents;
  hintCount++;
}
assert(computeWin(level, tents), 'following applyHint from empty reaches a win');
assert(applyHint(level, level.solutionTents) === null, 'applyHint on the finished solution has nothing left to reveal');

// Deliberate non-matching-but-adjacent-counts-ok case: two trees each only
// reachable via the same single tent, plus an unrelated tent placed
// elsewhere so total counts still balance (2 trees, 2 tents) and no two
// tents touch. A naive "every tree has >=1 adjacent tent" check would
// wrongly accept this (both trees ARE adjacent to the shared tent) -- only
// a real bipartite matching catches that the shared tent can serve just one
// of them.
const sharedTentTrees: TentsAndTreesLevel = {
  rows: 3,
  cols: 3,
  trees: [
    [true, false, false],
    [false, false, false],
    [true, false, false],
  ],
  rowTargets: [1, 1, 0],
  colTargets: [1, 0, 1],
  solutionTents: [
    [false, false, true],
    [true, false, false],
    [false, false, false],
  ],
};
assert(
  !computeWin(sharedTentTrees, sharedTentTrees.solutionTents),
  'two trees sharing their only common tent is correctly rejected despite matching row/col counts and no touching tents'
);
assert(
  !hasPerfectMatching(
    [
      { r: 0, c: 0 },
      { r: 2, c: 0 },
    ],
    [
      { r: 0, c: 2 },
      { r: 1, c: 0 },
    ]
  ),
  'hasPerfectMatching directly reports no perfect matching for the shared-tent case'
);

// Regression check for a live-UI bug caught during playtest: a single tent
// bordering three trees ([-,T,-] / [T,-,T] with the tent in the empty middle
// cell of the second row) used to mark all three trees "matched" since the
// old check was just "has *some* adjacent tent". Only one of the three can
// actually claim this tent, so exactly one should light up.
const threeTreesOneTent = matchedTreeCells(
  [
    { r: 0, c: 1 },
    { r: 1, c: 0 },
    { r: 1, c: 2 },
  ],
  [{ r: 1, c: 1 }]
);
assert(threeTreesOneTent.size === 1, 'a tent bordering three trees only matches exactly one of them, not all three');

console.log('\nAll engine smoke checks passed.');
