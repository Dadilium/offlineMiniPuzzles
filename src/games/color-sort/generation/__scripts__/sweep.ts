/**
 * Sweep the Color Sort generator across a spread of skill ratings and report
 * attempts-to-success, reject-reason breakdown, and solution-length --
 * kept here (rather than as a one-off) so it can be rerun whenever the
 * generator/solver changes. This is the checkpoint script: eyeball real
 * output before hand-tuning difficulty.ts's tier numbers further.
 *
 * Run with: npx tsx src/games/color-sort/generation/__scripts__/sweep.ts
 */
import type { ColorSortLevel } from '../../types';
import { difficultyParams, maxAttemptsFor, type SkillRating } from '../difficulty';
import { generateColorSortLevel } from '../generator';
import { mulberry32, seedFromLevelIndex } from '../rng';

function renderLevel(level: ColorSortLevel): string {
  const lines = level.tubes.map((t, i) => `  tube ${i}: [${t.join(',')}]${t.length === 0 ? ' (empty)' : ''}`);
  return lines.join('\n');
}

const RATINGS: SkillRating[] = [20, 50, 70, 90];
const LEVELS_PER_RATING = 8;
const DEDUP_WINDOW = 5;

function main(): void {
  for (const rating of RATINGS) {
    const params = difficultyParams(rating);
    const maxAttempts = maxAttemptsFor(params);
    const attemptCounts: number[] = [];
    const solutionLengths: number[] = [];
    let failures = 0;
    const recentFingerprints: string[] = [];
    let shownExample = false;

    for (let i = 0; i < LEVELS_PER_RATING; i++) {
      const levelIndex = rating * 1000 + i; // keep each rating's seed stream disjoint
      const rng = mulberry32(seedFromLevelIndex(levelIndex));
      const result = generateColorSortLevel(rng, params, recentFingerprints, maxAttempts);

      if (!('level' in result)) {
        failures++;
        console.log(`  rating=${rating} index=${levelIndex}: FAILED after ${result.attempts} attempts`);
        continue;
      }

      attemptCounts.push(result.attempts);
      solutionLengths.push(result.level.parMoves);
      recentFingerprints.push(result.fingerprint);
      if (recentFingerprints.length > DEDUP_WINDOW) recentFingerprints.shift();

      if (!shownExample) {
        shownExample = true;
        console.log(
          `\nExample (rating=${rating}, colors=${result.level.colors}, tubes=${result.level.tubes.length}, parMoves=${result.level.parMoves}, attempts=${result.attempts}):`
        );
        console.log(renderLevel(result.level));
        console.log('');
      }
    }

    const avgAttempts = attemptCounts.length ? Math.round(attemptCounts.reduce((a, b) => a + b, 0) / attemptCounts.length) : 0;
    const maxAttemptsSeen = attemptCounts.length ? Math.max(...attemptCounts) : 0;
    const avgSolution = solutionLengths.length ? Math.round(solutionLengths.reduce((a, b) => a + b, 0) / solutionLengths.length) : 0;
    const minSolution = solutionLengths.length ? Math.min(...solutionLengths) : 0;
    console.log(
      `rating=${rating} (colors ${params.colorsRange[0]}-${params.colorsRange[1]}, extraEmpty ${params.extraEmptyRange[0]}-${params.extraEmptyRange[1]}): ` +
        `${LEVELS_PER_RATING - failures}/${LEVELS_PER_RATING} ok, avgSolution=${avgSolution}, minSolution=${minSolution}, ` +
        `avgAttempts=${avgAttempts}, maxAttempts=${maxAttemptsSeen}, failures=${failures}`
    );
  }
}

main();
