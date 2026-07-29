/**
 * Smoke test for engine.ts / generation/solver.ts against a real generated
 * level -- checks pourMove legality/effects, computeWin, and that a live
 * hint/stuck check behaves sanely. Kept here for future use per CLAUDE.md
 * (not a throwaway).
 *
 * Run with: npx tsx src/games/color-sort/__scripts__/engineSmoke.ts
 */
import { computeWin, findBestMove, isStuck, pourMove } from '../engine';
import { createLevelForIndex } from '../generation';
import type { Tube } from '../types';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAILED: ${message}`);
  console.log(`ok: ${message}`);
}

const result = createLevelForIndex(0, 60, []);
if (!('level' in result)) throw new Error('generation failed');
const level = result.level;
console.log(`level: ${level.colors} colors, ${level.tubes.length} tubes, capacity ${level.capacity}, parMoves=${level.parMoves}`);

assert(!computeWin(level.tubes, level.capacity), 'a freshly dealt board is not a win');
assert(pourMove(level.tubes, level.capacity, 0, 0) === null, 'pouring a tube into itself is rejected');

// Find two tubes where a legal pour exists, and verify its effect.
let legalFrom = -1;
let legalTo = -1;
outer: for (let from = 0; from < level.tubes.length; from++) {
  if (level.tubes[from].length === 0) continue;
  for (let to = 0; to < level.tubes.length; to++) {
    if (to === from) continue;
    if (pourMove(level.tubes, level.capacity, from, to)) {
      legalFrom = from;
      legalTo = to;
      break outer;
    }
  }
}
assert(legalFrom !== -1, 'a freshly dealt board has at least one legal pour');

const before = level.tubes;
const poured = pourMove(before, level.capacity, legalFrom, legalTo)!;
const topColor = before[legalFrom][before[legalFrom].length - 1];
assert(poured.color === topColor, "pour reports the source tube's top color");
assert(poured.tubes[legalFrom].length + poured.amount === before[legalFrom].length, 'source tube shrinks by exactly the poured amount');
assert(poured.tubes[legalTo].length === before[legalTo].length + poured.amount, 'destination tube grows by exactly the poured amount');
for (let i = 0; i < before.length; i++) {
  if (i === legalFrom || i === legalTo) continue;
  assert(poured.tubes[i] === before[i], `untouched tube ${i} keeps the same array reference (structural sharing)`);
}

// Replay the generator's own certified solution and confirm it wins.
const solutionMovesResult = (() => {
  // The level type doesn't carry the move list (only parMoves), so re-derive
  // it live via findBestMove -- this also exercises the exact function the
  // UI calls for hints.
  let tubes: Tube[] = level.tubes.map((t) => t.slice());
  const capacity = level.capacity;
  let steps = 0;
  const maxSteps = level.parMoves + 5;
  while (!computeWin(tubes, capacity) && steps < maxSteps) {
    const move = findBestMove(tubes, capacity);
    if (!move) return { tubes, ok: false, steps };
    const applied = pourMove(tubes, capacity, move.from, move.to);
    if (!applied) return { tubes, ok: false, steps };
    tubes = applied.tubes;
    steps++;
  }
  return { tubes, ok: computeWin(tubes, capacity), steps };
})();
assert(solutionMovesResult.ok, `following findBestMove from the start reaches a win within ${level.parMoves + 5} steps`);
assert(solutionMovesResult.steps <= level.parMoves + 5, 'greedy hint-following does not blow past a generous step budget');
assert(!isStuck(solutionMovesResult.tubes, level.capacity), 'a won board is never reported stuck');
assert(isStuck([], level.capacity) === false, 'an empty tube list trivially "wins" (vacuously), never stuck');

console.log('\nAll engine smoke checks passed.');
