/**
 * Sweep the Cross Sums generator across a spread of skill ratings and report
 * attempts-to-success, board dimensions, and kept-cell density -- kept here
 * (rather than as a one-off) so it can be rerun whenever the generator
 * changes. This is the plan's checkpoint script: eyeball real output before
 * building the skill curve further, levelSource.ts, or any UI.
 *
 * Run with: npx tsx src/games/cross-sums/generation/__scripts__/sweep.ts
 */
import type { CrossSumsLevel } from '../../types';
import {
  difficultyParams,
  generateCrossSumsLevel,
  maxAttemptsFor,
  mulberry32,
  seedFromLevelIndex,
  type SkillRating,
} from '../index';

function renderLevel(level: CrossSumsLevel): string {
  const { rows, cols, grid, rowTargets, colTargets, solutionMask } = level;
  const cellWidth = 4;
  const lines: string[] = [];

  for (let r = 0; r < rows; r++) {
    const cells = grid[r]
      .map((v, c) => (solutionMask[r][c] ? `${v}*` : `${v}`))
      .map((s) => s.padStart(cellWidth, ' '));
    lines.push(cells.join('') + '  |' + String(rowTargets[r]).padStart(3, ' '));
  }

  lines.push('-'.repeat(cellWidth * cols + 4));
  lines.push(colTargets.map((t) => String(t).padStart(cellWidth, ' ')).join(''));
  return lines.join('\n');
}

const RATINGS: SkillRating[] = [20, 40, 60, 80, 100];
const LEVELS_PER_RATING = 10;
const DEDUP_WINDOW = 5;

function main(): void {
  let shownExample = false;

  for (const rating of RATINGS) {
    const params = difficultyParams(rating);
    const maxAttempts = maxAttemptsFor(params);
    const attemptCounts: number[] = [];
    const densities: number[] = [];
    let failures = 0;
    const recentFingerprints: string[] = [];

    for (let i = 0; i < LEVELS_PER_RATING; i++) {
      const levelIndex = rating * 1000 + i; // keep each rating's seed stream disjoint
      const rng = mulberry32(seedFromLevelIndex(levelIndex));
      const result = generateCrossSumsLevel(rng, params, recentFingerprints, maxAttempts);

      if (!('level' in result)) {
        failures++;
        console.log(`  rating=${rating} index=${levelIndex}: FAILED after ${result.attempts} attempts`);
        continue;
      }

      const { rows, cols, solutionMask } = result.level;
      const keptCount = solutionMask.reduce((n, row) => n + row.filter(Boolean).length, 0);
      attemptCounts.push(result.attempts);
      densities.push(keptCount / (rows * cols));
      recentFingerprints.push(result.fingerprint);
      if (recentFingerprints.length > DEDUP_WINDOW) recentFingerprints.shift();

      if (!shownExample && rating === 60) {
        shownExample = true;
        console.log(
          `\nExample (rating=${rating}, ${rows}x${cols}, keptDensity=${(keptCount / (rows * cols)).toFixed(2)}, attempts=${result.attempts}):`
        );
        console.log(renderLevel(result.level));
        console.log('');
      }
    }

    const avgAttempts = attemptCounts.length
      ? Math.round(attemptCounts.reduce((a, b) => a + b, 0) / attemptCounts.length)
      : 0;
    const maxAttemptsSeen = attemptCounts.length ? Math.max(...attemptCounts) : 0;
    const avgDensity = densities.length ? densities.reduce((a, b) => a + b, 0) / densities.length : 0;
    console.log(
      `rating=${rating} (${params.rowsRange[0]}-${params.rowsRange[1]} x ${params.colsRange[0]}-${params.colsRange[1]}): ` +
        `${LEVELS_PER_RATING - failures}/${LEVELS_PER_RATING} ok, avgDensity=${avgDensity.toFixed(2)}, ` +
        `avgAttempts=${avgAttempts}, maxAttempts=${maxAttemptsSeen}, failures=${failures}`
    );
  }
}

main();
