/**
 * Smoke test for engine.ts / generation/solver.ts against a real generated
 * level -- checks computeWin, applyHint, placeRect's move-shape validation,
 * and specifically that the solver doesn't collapse genuine ambiguity into
 * a false "unique" result. Kept here for future use per CLAUDE.md (not a
 * throwaway).
 *
 * Run with: npx tsx src/games/shikaku/__scripts__/engineSmoke.ts
 */
import { applyHint, area, clueIndicesIn, computeOwnerGrid, computeWin, placeRect, rectsOverlap } from '../engine';
import { createLevelForIndex, solveShikaku } from '../generation';
import type { PlacedRect } from '../types';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAILED: ${message}`);
  console.log(`ok: ${message}`);
}

const result = createLevelForIndex(0, 60, []);
if (!('level' in result)) throw new Error('generation failed');
const level = result.level;
console.log(`level: ${level.rows}x${level.cols}, ${level.clues.length} clues`);

assert(!computeWin(level, []), 'an empty board is not a win');

const solutionAsPlaced: PlacedRect[] = level.solutionRects.map((rect, clueIndex) => ({ ...rect, clueIndex }));
assert(computeWin(level, solutionAsPlaced), "the generator's certified solution (as PlacedRect[]) wins");

// Each solutionRects[i] contains exactly its own clue and matches its area --
// the two structural properties `applyHint` and the generator's uniqueness
// check both lean on being true unconditionally.
for (let i = 0; i < level.clues.length; i++) {
  const rect = level.solutionRects[i];
  const containedClueIndices = clueIndicesIn(level.clues, rect);
  assert(
    containedClueIndices.length === 1 && containedClueIndices[0] === i,
    `solutionRects[${i}] contains exactly its own clue`
  );
  assert(area(rect) === level.clues[i].value, `solutionRects[${i}] area matches clue ${i}'s value`);
}

// Zero pairwise overlap and full coverage across solutionRects.
for (let i = 0; i < level.solutionRects.length; i++) {
  for (let j = i + 1; j < level.solutionRects.length; j++) {
    assert(!rectsOverlap(level.solutionRects[i], level.solutionRects[j]), `solutionRects[${i}] and [${j}] don't overlap`);
  }
}
const solutionOwner = computeOwnerGrid(level, solutionAsPlaced);
let fullyCovered = true;
for (let r = 0; r < level.rows; r++) {
  for (let c = 0; c < level.cols; c++) {
    if (solutionOwner[r][c] === -1) fullyCovered = false;
  }
}
assert(fullyCovered, 'solutionRects fully covers the board with no gaps');

// Replay applyHint from empty and confirm it converges exactly onto the certified solution.
let placed: PlacedRect[] = [];
let hintCount = 0;
const maxHints = level.clues.length + 1;
while (!computeWin(level, placed) && hintCount < maxHints) {
  const hint = applyHint(level, placed);
  if (!hint) break;
  placed = hint.placedRects;
  hintCount++;
}
assert(computeWin(level, placed), 'following applyHint from empty reaches a win');
assert(applyHint(level, solutionAsPlaced) === null, 'applyHint on the finished solution has nothing left to reveal');

// --- placeRect unit cases, on a small hand-built board -----------------
// rows=1, cols=4: clue0 (value 2) covers cells 0-1, clue1 (value 2) covers
// cells 2-3 in the intended solution, but placeRect itself never checks
// area against the clue's value -- only move *shape* (clue count, overlap).
const tinyLevel = {
  rows: 1,
  cols: 4,
  clues: [
    { r: 0, c: 0, value: 2 },
    { r: 0, c: 3, value: 2 },
  ],
  solutionRects: [
    { r0: 0, c0: 0, r1: 0, c1: 1 },
    { r0: 0, c0: 2, r1: 0, c1: 3 },
  ],
};

const noClueResult = placeRect(tinyLevel, [], { r0: 0, c0: 1, r1: 0, c1: 1 });
assert('error' in noClueResult && noClueResult.error === 'no-clue', 'placeRect rejects a box covering zero clues');

const multiClueResult = placeRect(tinyLevel, [], { r0: 0, c0: 0, r1: 0, c1: 3 });
assert(
  'error' in multiClueResult && multiClueResult.error === 'multiple-clues',
  'placeRect rejects a box covering two clues'
);

const place0 = placeRect(tinyLevel, [], { r0: 0, c0: 0, r1: 0, c1: 1 });
assert('placedRects' in place0, 'placeRect accepts a valid box for clue 0');
const afterPlace0 = 'placedRects' in place0 ? place0.placedRects : [];

const place1 = placeRect(tinyLevel, afterPlace0, { r0: 0, c0: 2, r1: 0, c1: 3 });
assert('placedRects' in place1, 'placeRect accepts a valid box for clue 1');
const afterBoth = 'placedRects' in place1 ? place1.placedRects : [];
assert(afterBoth.length === 2, 'both clues now have a placed rect');

const resize0 = placeRect(tinyLevel, afterBoth, { r0: 0, c0: 0, r1: 0, c1: 0 });
assert('placedRects' in resize0, 'placeRect accepts a resize of clue 0 (no forced delete-first)');
if ('placedRects' in resize0) {
  assert(resize0.placedRects.length === 2, 'resize replaces clue 0 in place rather than appending');
  const resized = resize0.placedRects.find((rect) => rect.clueIndex === 0);
  assert(resized !== undefined && resized.c0 === 0 && resized.c1 === 0, "clue 0's rect shrank to just its own cell");
}

const overlapResult = placeRect(tinyLevel, afterBoth, { r0: 0, c0: 0, r1: 0, c1: 2 });
assert(
  'error' in overlapResult && overlapResult.error === 'overlap',
  "placeRect rejects a box for clue 0 that overlaps clue 1's placed rect"
);

// --- genuine ambiguity: solveShikaku must not collapse a real 2-solution board ---
// A 2x4 board with a value-4 clue at (0,0) and a value-4 clue at (1,3) has (at
// least) two valid tilings: split into top row / bottom row, or split into
// left 2x2 / right 2x2. Both are legal partitions satisfying every clue.
const ambiguousLevel = {
  rows: 2,
  cols: 4,
  clues: [
    { r: 0, c: 0, value: 4 },
    { r: 1, c: 3, value: 4 },
  ],
  solutionRects: [
    { r0: 0, c0: 0, r1: 1, c1: 1 },
    { r0: 0, c0: 2, r1: 1, c1: 3 },
  ],
};
const ambiguousSolutions = solveShikaku(ambiguousLevel, 2);
assert(ambiguousSolutions.length === 2, 'solveShikaku finds both solutions of a genuinely ambiguous board, capped at 2');
// This is exactly the condition `generateShikakuLevel` checks per attempt
// (`if (solutions.length !== 1) continue;`) -- a board like this would never
// be shipped, it would simply cause that attempt to be discarded and retried.
assert(ambiguousSolutions.length !== 1, "the generator's uniqueness gate (solutions.length !== 1) would reject this board");

console.log('\nAll engine smoke checks passed.');
