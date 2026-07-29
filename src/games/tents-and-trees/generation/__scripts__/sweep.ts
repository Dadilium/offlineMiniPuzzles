/**
 * Sweep the Tents & Trees generator across a spread of skill ratings and
 * report attempts-to-success, board dimensions, and tree density -- kept
 * here (rather than as a one-off) so it can be rerun whenever the generator
 * or solver changes. This is the plan's checkpoint script: eyeball real
 * output before building safeBoards.ts, the UI, or the skill curve further.
 *
 * Run with: npx tsx src/games/tents-and-trees/generation/__scripts__/sweep.ts
 */
import type { TentsAndTreesLevel } from '../../types';
import {
  difficultyParams,
  generateTentsAndTreesLevel,
  maxAttemptsFor,
  mulberry32,
  seedFromLevelIndex,
  type SkillRating,
} from '../index';

function renderLevel(level: TentsAndTreesLevel): string {
  const { rows, cols, trees, rowTargets, colTargets, solutionTents } = level;
  const lines: string[] = [];

  for (let r = 0; r < rows; r++) {
    const cells = Array.from({ length: cols }, (_, c) => (trees[r][c] ? ' T' : solutionTents[r][c] ? ' A' : ' .'));
    lines.push(cells.join('') + '  |' + String(rowTargets[r]).padStart(3, ' '));
  }

  lines.push('-'.repeat(2 * cols + 4));
  lines.push(colTargets.map((t) => String(t).padStart(2, ' ')).join(''));
  return lines.join('\n');
}

const RATINGS: SkillRating[] = [20, 40, 60, 80, 100];
const LEVELS_PER_RATING = 10;
const DEDUP_WINDOW = 5;

function main(): void {
  for (const rating of RATINGS) {
    const params = difficultyParams(rating);
    const maxAttempts = maxAttemptsFor(params);
    const attemptCounts: number[] = [];
    const densities: number[] = [];
    let failures = 0;
    const recentFingerprints: string[] = [];
    let exampleLevel: TentsAndTreesLevel | null = null;
    let exampleAttempts = 0;

    for (let i = 0; i < LEVELS_PER_RATING; i++) {
      const levelIndex = rating * 1000 + i; // keep each rating's seed stream disjoint
      const rng = mulberry32(seedFromLevelIndex(levelIndex));
      const result = generateTentsAndTreesLevel(rng, params, recentFingerprints, maxAttempts);

      if (!('level' in result)) {
        failures++;
        console.log(`  rating=${rating} index=${levelIndex}: FAILED after ${result.attempts} attempts`);
        continue;
      }

      const { rows, cols, trees } = result.level;
      const treeCount = trees.reduce((n, row) => n + row.filter(Boolean).length, 0);
      attemptCounts.push(result.attempts);
      densities.push(treeCount / (rows * cols));
      recentFingerprints.push(result.fingerprint);
      if (recentFingerprints.length > DEDUP_WINDOW) recentFingerprints.shift();

      if (!exampleLevel) {
        exampleLevel = result.level;
        exampleAttempts = result.attempts;
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

    if (exampleLevel) {
      console.log(`Example (rating=${rating}, attempts=${exampleAttempts}):`);
      console.log(renderLevel(exampleLevel));
      console.log('');
      console.log(JSON.stringify(exampleLevel));
      console.log('');
    }
  }
}

main();
