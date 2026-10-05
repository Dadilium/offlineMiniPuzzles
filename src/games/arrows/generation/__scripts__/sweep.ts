/**
 * Sweeps the Arrows generator across every tier and reports gate pass rate,
 * dependency depth (clear rounds), initially-free ratio, coverage, arrow
 * count/length and generation time -- rerun whenever the generator or the
 * tier table in difficulty.ts changes. `--render` prints one ASCII board per
 * tier to eyeball shape quality.
 *
 * Run with: npx tsx src/games/arrows/generation/__scripts__/sweep.ts [--levels 12] [--render]
 */
import { analyzeClearing, headDirection, toRowCol } from '../../engine';
import type { ArrowsLevel } from '../../types';
import { createLevelForIndex, createLevelForIndexRobust, difficultyParams, type SkillRating } from '../index';

// Each tier's floor, middle and ceiling -- params ease across a band (see difficultyParams).
const RATINGS: SkillRating[] = [0, 20, 39, 40, 50, 59, 60, 70, 79, 80, 90, 100, 101, 125, 150];
const argv = (globalThis as unknown as { process: { argv: string[] } }).process.argv;

function argValue(flag: string, fallback: number): number {
  const i = argv.indexOf(flag);
  return i >= 0 ? Number(argv[i + 1]) : fallback;
}

const HEAD_GLYPH: Record<string, string> = { '-1,0': '^', '1,0': 'v', '0,-1': '<', '0,1': '>' };

function render(level: ArrowsLevel): string {
  const grid = Array.from({ length: level.rows }, () => new Array<string>(level.cols).fill(' '));
  for (const arrow of level.arrows) {
    arrow.path.forEach((cell, i) => {
      const { r, c } = toRowCol(cell, level.cols);
      if (i === arrow.path.length - 1) {
        const dir = headDirection(arrow, level.cols);
        grid[r][c] = HEAD_GLYPH[`${dir.dr},${dir.dc}`];
      } else {
        grid[r][c] = String.fromCharCode(97 + (arrow.id % 26));
      }
    });
  }
  return grid.map((row) => row.join(' ')).join('\n');
}

function mean(values: number[]): string {
  return values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2) : '-';
}

function main(): void {
  const levels = argValue('--levels', 12);
  const shouldRender = argv.includes('--render');

  for (const rating of RATINGS) {
    const params = difficultyParams(rating);
    let passed = 0;
    const rounds: number[] = [];
    const freeRatios: number[] = [];
    const coverages: number[] = [];
    const counts: number[] = [];
    const lengths: number[] = [];
    const attempts: number[] = [];
    const times: number[] = [];

    for (let i = 0; i < levels; i++) {
      const start = Date.now();
      const result = createLevelForIndex(i, rating, []);
      if ('level' in result) {
        passed++;
        attempts.push(result.attempts);
      }
      const level = 'level' in result ? result.level : createLevelForIndexRobust(i, rating, []);
      times.push(Date.now() - start);

      const analysis = analyzeClearing(level);
      if (!analysis.solvable) throw new Error(`Unsolvable board at rating ${rating}, level ${i}`);
      rounds.push(analysis.rounds);
      freeRatios.push(analysis.initiallyFree / level.arrows.length);
      coverages.push(level.arrows.reduce((sum, arrow) => sum + arrow.path.length, 0) / (level.rows * level.cols));
      counts.push(level.arrows.length);
      lengths.push(...level.arrows.map((arrow) => arrow.path.length));
      if (shouldRender && i === 0) console.log(`\n${render(level)}\n`);
    }

    console.log(
      [
        `rating ${rating} (${params.tier})`,
        `gates ${passed}/${levels}`,
        `attempts ${mean(attempts)}`,
        `rounds ${mean(rounds)} [min ${Math.min(...rounds)}]`,
        `free ${mean(freeRatios)}`,
        `coverage ${mean(coverages)}`,
        `arrows ${mean(counts)}`,
        `len ${mean(lengths)} [max ${Math.max(...lengths)}]`,
        `ms ${mean(times)} [max ${Math.max(...times).toFixed(0)}]`,
      ].join(' | ')
    );
  }
}

main();
