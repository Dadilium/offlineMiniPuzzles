/**
 * Assertion checks for Kings' drag-to-mark strokes and the auto-mark gate.
 *
 * Run with: npx tsx src/games/kings/__scripts__/markStroke.check.ts
 */
import { applyMarkStroke, markStrokeModeFor, showsAutoMarks, strokeCellValue } from '../engine';
import type { CellState, KingsLevel } from '../types';

function check(name: string, ok: boolean): boolean {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}`);
  return ok;
}

const board: CellState[][] = [
  [0, 1, 2],
  [3, 0, 1],
  [0, 0, 0],
];
const level = (difficulty?: KingsLevel['difficulty']): KingsLevel => ({ n: 3, regions: [], solution: [], difficulty });

const results = [
  check('drag from empty paints, from a dot erases', markStrokeModeFor(0) === 'mark' && markStrokeModeFor(1) === 'erase' && markStrokeModeFor(2) === 'mark'),
  check('kings and hinted kings never change', strokeCellValue(2, 'mark') === 2 && strokeCellValue(3, 'erase') === 3),
  check(
    'mark stroke only fills empty cells',
    JSON.stringify(applyMarkStroke(board, [[0, 0], [0, 1], [0, 2], [1, 1]], 'mark')) === JSON.stringify([[1, 1, 2], [3, 1, 1], [0, 0, 0]])
  ),
  check(
    'erase stroke only clears dots',
    JSON.stringify(applyMarkStroke(board, [[0, 1], [1, 0], [1, 2], [2, 2]], 'erase')) === JSON.stringify([[0, 0, 2], [3, 0, 0], [0, 0, 0]])
  ),
  check('no-op stroke returns the same board', applyMarkStroke(board, [[0, 2], [1, 0]], 'mark') === board),
  check('input board is never mutated', board[0][0] === 0 && board[1][1] === 0),
  check(
    'auto-marks only below Hard',
    showsAutoMarks(level('easy')) && showsAutoMarks(level('medium')) && showsAutoMarks(level()) && !showsAutoMarks(level('hard')) && !showsAutoMarks(level('expert'))
  ),
  check(
    'untagged levels follow the selected tier; a tagged level ignores it',
    !showsAutoMarks(level(), 'hard') && showsAutoMarks(level(), 'medium') && showsAutoMarks(level('easy'), 'expert')
  ),
];

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
if (failed > 0) throw new Error(`${failed} mark-stroke check(s) failed`);
