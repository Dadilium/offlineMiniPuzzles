/**
 * Sweep the Shikaku generator across a spread of skill ratings and report
 * attempts-to-success, clue/rectangle stats, and the "sliver fraction" (how
 * many 1xN/Nx1 leaves a board has -- a proxy for degenerate/boring
 * partitions) -- kept here (rather than as a one-off) so it can be rerun
 * whenever the generator or solver changes. This is the plan's checkpoint
 * script: eyeball real output before finalizing safeBoards.ts, the UI, or
 * the skill curve further.
 *
 * Run with: npx tsx src/games/shikaku/generation/__scripts__/sweep.ts
 */
import { area, computeOwnerGrid } from '../../engine';
import type { ShikakuLevel } from '../../types';
import { difficultyParams, generateShikakuLevel, maxAttemptsFor, mulberry32, seedFromLevelIndex, type SkillRating } from '../index';

function isSliver(width: number, height: number): boolean {
  return width === 1 || height === 1;
}

function renderClueGrid(level: ShikakuLevel): string {
  const grid = Array.from({ length: level.rows }, () => new Array<string>(level.cols).fill(' .'));
  for (const clue of level.clues) {
    grid[clue.r][clue.c] = String(clue.value).padStart(2, ' ');
  }
  return grid.map((row) => row.join(' ')).join('\n');
}

function letterFor(index: number): string {
  const letter = String.fromCharCode(65 + (index % 26));
  const cycle = Math.floor(index / 26);
  return cycle === 0 ? `${letter} ` : `${letter}${cycle}`;
}

function renderRegionGrid(level: ShikakuLevel): string {
  const placedRects = level.solutionRects.map((rect, clueIndex) => ({ ...rect, clueIndex }));
  const owner = computeOwnerGrid(level, placedRects);
  const grid = owner.map((row) => row.map((clueIndex) => (clueIndex === -1 ? '??' : letterFor(clueIndex))));
  return grid.map((row) => row.join(' ')).join('\n');
}

const RATINGS: SkillRating[] = [10, 40, 60, 80];
const LEVELS_PER_RATING = 10;
const DEDUP_WINDOW = 5;

function main(): void {
  for (const rating of RATINGS) {
    const params = difficultyParams(rating);
    const maxAttempts = maxAttemptsFor(params.rowsRange[1] * params.colsRange[1]);
    const attemptCounts: number[] = [];
    const clueCounts: number[] = [];
    const rectAreas: number[] = [];
    const sliverFractions: number[] = [];
    let failures = 0;
    const recentFingerprints: string[] = [];
    let exampleLevel: ShikakuLevel | null = null;
    let exampleAttempts = 0;

    for (let i = 0; i < LEVELS_PER_RATING; i++) {
      const levelIndex = rating * 1000 + i; // keep each rating's seed stream disjoint
      const rng = mulberry32(seedFromLevelIndex(levelIndex));
      const result = generateShikakuLevel(rng, params, recentFingerprints, maxAttempts);

      if (!('level' in result)) {
        failures++;
        console.log(`  rating=${rating} index=${levelIndex}: FAILED after ${result.attempts} attempts`);
        continue;
      }

      const { level } = result;
      attemptCounts.push(result.attempts);
      clueCounts.push(level.clues.length);
      recentFingerprints.push(result.fingerprint);
      if (recentFingerprints.length > DEDUP_WINDOW) recentFingerprints.shift();

      let sliverCount = 0;
      for (const rect of level.solutionRects) {
        rectAreas.push(area(rect));
        const width = rect.c1 - rect.c0 + 1;
        const height = rect.r1 - rect.r0 + 1;
        if (isSliver(width, height)) sliverCount++;
      }
      sliverFractions.push(sliverCount / level.solutionRects.length);

      if (!exampleLevel) {
        exampleLevel = level;
        exampleAttempts = result.attempts;
      }
    }

    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    const avgAttempts = Math.round(avg(attemptCounts));
    const maxAttemptsSeen = attemptCounts.length ? Math.max(...attemptCounts) : 0;
    const avgClueCount = avg(clueCounts);
    const avgRectArea = avg(rectAreas);
    const minRectArea = rectAreas.length ? Math.min(...rectAreas) : 0;
    const maxRectArea = rectAreas.length ? Math.max(...rectAreas) : 0;
    const avgSliverFraction = avg(sliverFractions);

    console.log(
      `rating=${rating} (rows ${params.rowsRange[0]}-${params.rowsRange[1]} x cols ${params.colsRange[0]}-${params.colsRange[1]}, rectArea ${params.minRectArea[0]}-${params.minRectArea[1]}..${params.maxRectArea[0]}-${params.maxRectArea[1]}): ` +
        `${LEVELS_PER_RATING - failures}/${LEVELS_PER_RATING} ok, avgAttempts=${avgAttempts}, maxAttempts=${maxAttemptsSeen}, failures=${failures}`
    );
    console.log(
      `  avgClueCount=${avgClueCount.toFixed(1)}, rectArea avg/min/max=${avgRectArea.toFixed(1)}/${minRectArea}/${maxRectArea}, ` +
        `avgSliverFraction=${avgSliverFraction.toFixed(2)}`
    );

    if (exampleLevel) {
      console.log(`Example (rating=${rating}, attempts=${exampleAttempts}):`);
      console.log('Clue grid:');
      console.log(renderClueGrid(exampleLevel));
      console.log('Region grid:');
      console.log(renderRegionGrid(exampleLevel));
      console.log('');
      console.log(JSON.stringify(exampleLevel));
      console.log('');
    }
  }
}

main();
