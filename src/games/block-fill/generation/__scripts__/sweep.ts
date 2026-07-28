/**
 * Sweep the Block Fill generator across a spread of skill ratings and report
 * attempts-to-success, board dimensions, achieved fill ratio, and any
 * failures -- kept here (rather than as a one-off) so it can be rerun
 * whenever the generator changes.
 *
 * Run with: npx tsx src/games/block-fill/generation/__scripts__/sweep.ts
 */
import type { Cell } from '../../types';
import { createLevelForIndex, INITIAL_SKILL_RATING, type SkillRating } from '../index';

function renderPath(rows: number, cols: number, fillable: boolean[][], path: Cell[], start: Cell): string {
  const grid: string[][] = Array.from({ length: rows }, () => Array(cols).fill(' # '));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (fillable[r][c]) grid[r][c] = ' . ';
    }
  }
  path.forEach((cell, i) => {
    grid[cell.r][cell.c] = i.toString().padStart(2, ' ');
  });
  grid[start.r][start.c] = grid[start.r][start.c].trim().padStart(2, ' ') + 'S';
  return grid.map((row) => row.map((cell) => cell.toString().padStart(3, ' ')).join('')).join('\n');
}

const RATINGS: SkillRating[] = [INITIAL_SKILL_RATING, 40, 60, 80, 100];
const LEVELS_PER_RATING = 8;
const DEDUP_WINDOW = 5;

function main(): void {
  let shownExample = false;

  for (const rating of RATINGS) {
    const attemptCounts: number[] = [];
    const fillRatios: number[] = [];
    let failures = 0;
    const recentFingerprints: string[] = [];

    for (let i = 0; i < LEVELS_PER_RATING; i++) {
      const levelIndex = rating * 1000 + i; // keep each rating's seed stream disjoint
      const result = createLevelForIndex(levelIndex, rating, recentFingerprints);

      if (!('level' in result)) {
        failures++;
        console.log(`  rating=${rating} index=${levelIndex}: FAILED after ${result.attempts} attempts`);
        continue;
      }

      const { rows, cols, fillable } = result.level;
      const fillableCount = fillable.reduce((n, row) => n + row.filter(Boolean).length, 0);
      attemptCounts.push(result.attempts);
      fillRatios.push(fillableCount / (rows * cols));
      recentFingerprints.push(result.fingerprint);
      if (recentFingerprints.length > DEDUP_WINDOW) recentFingerprints.shift();

      if (!shownExample && rating === 60) {
        shownExample = true;
        console.log(`\nExample (rating=${rating}, ${rows}x${cols}, fillRatio=${(fillableCount / (rows * cols)).toFixed(2)}):`);
        console.log(renderPath(rows, cols, fillable, result.level.solutionPath, result.level.start));
        console.log('');
      }
    }

    const avgAttempts = attemptCounts.length ? Math.round(attemptCounts.reduce((a, b) => a + b, 0) / attemptCounts.length) : 0;
    const avgFillRatio = fillRatios.length ? fillRatios.reduce((a, b) => a + b, 0) / fillRatios.length : 0;
    console.log(
      `rating=${rating}: ${LEVELS_PER_RATING - failures}/${LEVELS_PER_RATING} ok, avgFillRatio=${avgFillRatio.toFixed(2)}, ` +
        `avgAttempts=${avgAttempts}, failures=${failures}`
    );
  }
}

main();
