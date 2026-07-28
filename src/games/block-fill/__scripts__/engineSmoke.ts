/**
 * Smoke test for engine.ts against a real generated level -- checks
 * extendPath/rewindTo legality rules and that Hint/stuck detection agree
 * with the generator's own solutionPath. Kept here for future use per
 * CLAUDE.md (not a throwaway).
 *
 * Run with: npx tsx src/games/block-fill/__scripts__/engineSmoke.ts
 */
import { computeWin, extendPath, findHintCell, isStuck, rewindTo } from '../engine';
import { createLevelForIndex } from '../generation';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAILED: ${message}`);
  console.log(`ok: ${message}`);
}

const result = createLevelForIndex(0, 60, []);
if (!('level' in result)) throw new Error('generation failed');
const level = result.level;
console.log(`level ${level.rows}x${level.cols}, solution length=${level.solutionPath.length}`);

let path = [level.start];
const half = Math.floor(level.solutionPath.length / 2);
for (let i = 1; i <= half; i++) {
  const next = extendPath(level, path, level.solutionPath[i]);
  if (!next) throw new Error(`extendPath rejected a legal solution step at i=${i}`);
  path = next;
}
assert(!computeWin(level, path), 'halfway through the solution is not yet a win');
assert(!isStuck(level, path), 'halfway through the solution is not stuck');

assert(extendPath(level, path, level.start) === null, 're-entering the start cell is rejected');
const farCell = level.solutionPath[level.solutionPath.length - 1];
assert(extendPath(level, path, farCell) === null, 'a non-adjacent cell is rejected');

const hint = findHintCell(level, path);
const expected = level.solutionPath[half + 1];
assert(!!hint && hint.r === expected.r && hint.c === expected.c, 'hint proposes the actual next solution cell');

const rewound = rewindTo(path, level.start);
assert(rewound?.length === 1, 'rewinding to the start truncates back to a length-1 path');
assert(rewindTo(path, farCell) === null, 'rewinding to an off-path cell is rejected');

let full = [level.start];
for (let i = 1; i < level.solutionPath.length; i++) {
  const next = extendPath(level, full, level.solutionPath[i]);
  if (!next) throw new Error(`full replay failed at i=${i}`);
  full = next;
}
assert(computeWin(level, full), 'replaying the full solution wins');

console.log('\nAll engine smoke checks passed.');
