/**
 * Smoke test for engine.ts against hand-built fixtures and a real generated
 * level -- checks placementCells, matchPlacement (both drag directions),
 * lineFromDrag's 8-direction snapping/clipping, and isLevelComplete. Kept
 * here for future use per CLAUDE.md (not a throwaway).
 *
 * Run with: npx tsx src/games/find-words/__scripts__/engineSmoke.ts
 */
import { isLevelComplete, lineFromDrag, matchPlacement, placementCells } from '../engine';
import { createLevelForIndex } from '../generation';
import type { FindWordsLevel } from '../types';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAILED: ${message}`);
  console.log(`ok: ${message}`);
}

// --- placementCells --------------------------------------------------
assert(
  JSON.stringify(placementCells({ word: 'CAT', row: 2, col: 3, direction: 'E' })) ===
    JSON.stringify([{ r: 2, c: 3 }, { r: 2, c: 4 }, { r: 2, c: 5 }]),
  'placementCells E extends rightward'
);
assert(
  JSON.stringify(placementCells({ word: 'CAT', row: 2, col: 3, direction: 'W' })) ===
    JSON.stringify([{ r: 2, c: 3 }, { r: 2, c: 2 }, { r: 2, c: 1 }]),
  'placementCells W extends leftward'
);
assert(
  JSON.stringify(placementCells({ word: 'CAT', row: 1, col: 1, direction: 'SE' })) ===
    JSON.stringify([{ r: 1, c: 1 }, { r: 2, c: 2 }, { r: 3, c: 3 }]),
  'placementCells SE extends down-right'
);
assert(
  JSON.stringify(placementCells({ word: 'CAT', row: 3, col: 3, direction: 'NW' })) ===
    JSON.stringify([{ r: 3, c: 3 }, { r: 2, c: 2 }, { r: 1, c: 1 }]),
  'placementCells NW extends up-left'
);

// --- matchPlacement -----------------------------------------------------
const tinyLevel: FindWordsLevel = {
  rows: 4,
  cols: 4,
  grid: [
    ['C', 'A', 'T', 'X'],
    ['X', 'X', 'X', 'X'],
    ['X', 'X', 'X', 'X'],
    ['X', 'X', 'X', 'X'],
  ],
  placements: [{ word: 'CAT', row: 0, col: 0, direction: 'E' }],
};

assert(matchPlacement(tinyLevel, [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }], []) === 0, 'matchPlacement finds a forward drag');
assert(matchPlacement(tinyLevel, [{ r: 0, c: 2 }, { r: 0, c: 1 }, { r: 0, c: 0 }], []) === 0, 'matchPlacement finds the same word dragged backwards');
assert(matchPlacement(tinyLevel, [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }], [0]) === null, 'matchPlacement ignores an already-found placement');
assert(matchPlacement(tinyLevel, [{ r: 0, c: 0 }], []) === null, 'matchPlacement rejects a single-cell (tap, not a drag) selection');
assert(matchPlacement(tinyLevel, [{ r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }], []) === null, 'matchPlacement rejects a line that spells nothing placed');

assert(!isLevelComplete([], tinyLevel), 'no found words is not complete');
assert(isLevelComplete([0], tinyLevel), 'every placement found is complete');

// --- lineFromDrag: 8-direction snapping + bounds clipping ---------------
const anchor = { r: 4, c: 4 };
assert(JSON.stringify(lineFromDrag(anchor, anchor, 10, 10)) === JSON.stringify([anchor]), 'lineFromDrag with no movement returns just the anchor');
assert(
  JSON.stringify(lineFromDrag(anchor, { r: 4, c: 7 }, 10, 10)) ===
    JSON.stringify([{ r: 4, c: 4 }, { r: 4, c: 5 }, { r: 4, c: 6 }, { r: 4, c: 7 }]),
  'lineFromDrag snaps a horizontal drag to E'
);
assert(
  JSON.stringify(lineFromDrag(anchor, { r: 1, c: 4 }, 10, 10)) ===
    JSON.stringify([{ r: 4, c: 4 }, { r: 3, c: 4 }, { r: 2, c: 4 }, { r: 1, c: 4 }]),
  'lineFromDrag snaps a vertical drag to N'
);
assert(
  JSON.stringify(lineFromDrag(anchor, { r: 7, c: 7 }, 10, 10)) ===
    JSON.stringify([{ r: 4, c: 4 }, { r: 5, c: 5 }, { r: 6, c: 6 }, { r: 7, c: 7 }]),
  'lineFromDrag snaps an exact diagonal drag to SE'
);
assert(
  JSON.stringify(lineFromDrag(anchor, { r: 7, c: 5 }, 10, 10)) ===
    JSON.stringify([{ r: 4, c: 4 }, { r: 5, c: 4 }, { r: 6, c: 4 }, { r: 7, c: 4 }]),
  'lineFromDrag snaps a near-vertical drag onto the nearest axis'
);
assert(
  lineFromDrag({ r: 0, c: 0 }, { r: -5, c: -5 }, 10, 10).length === 1,
  'lineFromDrag clips a drag past the top-left edge down to just the anchor'
);
assert(
  JSON.stringify(lineFromDrag({ r: 0, c: 8 }, { r: 0, c: 20 }, 10, 10)) ===
    JSON.stringify([{ r: 0, c: 8 }, { r: 0, c: 9 }]),
  'lineFromDrag clips a drag past the right edge to the last in-bounds cell'
);

// --- a real generated level: every placement is self-consistent ---------
const result = createLevelForIndex(0, 60, 'en', []);
if (!('level' in result)) throw new Error('generation failed');
const level = result.level;
console.log(`level: ${level.rows}x${level.cols}, ${level.placements.length} words`);

for (const placement of level.placements) {
  const cells = placementCells(placement);
  for (let i = 0; i < cells.length; i++) {
    const { r, c } = cells[i];
    assert(r >= 0 && r < level.rows && c >= 0 && c < level.cols, `"${placement.word}" cell ${i} stays in bounds`);
    assert(level.grid[r][c] === placement.word[i], `"${placement.word}" cell ${i} matches the grid letter`);
  }
}

let found: number[] = [];
for (const placement of level.placements) {
  const cells = placementCells(placement);
  const matched = matchPlacement(level, cells, found);
  assert(matched !== null, `matchPlacement finds "${placement.word}" by its own stored cells`);
  if (matched !== null) found = [...found, matched];
}
assert(isLevelComplete(found, level), 'finding every placement completes the level');

console.log('\nAll engine smoke checks passed.');
