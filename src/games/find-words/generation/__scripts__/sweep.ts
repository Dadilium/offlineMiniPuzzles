/**
 * Sweep the Find Words generator across a spread of skill ratings and both
 * languages, reporting attempts-to-success and word-length stats -- kept
 * here (rather than as a one-off) so it can be rerun whenever the generator,
 * difficulty table, or word banks change. This is the plan's checkpoint
 * script: eyeball real output before finalizing safeBoards.ts or the
 * difficulty curve further.
 *
 * Run with: npx tsx src/games/find-words/generation/__scripts__/sweep.ts
 */
import type { FindWordsLevel } from '../../types';
import { difficultyParams, generateFindWordsLevel, mulberry32, seedFromLevelIndex, type SkillRating } from '../index';

function renderGrid(level: FindWordsLevel): string {
  return level.grid.map((row) => row.join(' ')).join('\n');
}

const RATINGS: SkillRating[] = [10, 50, 70, 90];
const LANGUAGES: Array<'en' | 'fr'> = ['en', 'fr'];
const LEVELS_PER_RATING = 15;
const DEDUP_WINDOW = 5;

function main(): void {
  for (const language of LANGUAGES) {
    for (const rating of RATINGS) {
      const params = difficultyParams(rating);
      const attemptCounts: number[] = [];
      const wordLengths: number[] = [];
      let failures = 0;
      const recentFingerprints: string[] = [];
      let exampleLevel: FindWordsLevel | null = null;
      let exampleAttempts = 0;

      for (let i = 0; i < LEVELS_PER_RATING; i++) {
        const levelIndex = rating * 1000 + i; // keep each rating's seed stream disjoint
        const rng = mulberry32(seedFromLevelIndex(levelIndex, language === 'fr' ? 1 : 0));
        const result = generateFindWordsLevel(rng, params, language, recentFingerprints, 500);

        if (!('level' in result)) {
          failures++;
          console.log(`  language=${language} rating=${rating} index=${levelIndex}: FAILED after ${result.attempts} attempts`);
          continue;
        }

        const { level } = result;
        attemptCounts.push(result.attempts);
        level.placements.forEach((p) => wordLengths.push(p.word.length));
        recentFingerprints.push(result.fingerprint);
        if (recentFingerprints.length > DEDUP_WINDOW) recentFingerprints.shift();

        if (!exampleLevel) {
          exampleLevel = level;
          exampleAttempts = result.attempts;
        }
      }

      const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
      const avgAttempts = Math.round(avg(attemptCounts));
      const maxAttemptsSeen = attemptCounts.length ? Math.max(...attemptCounts) : 0;
      const avgWordLength = avg(wordLengths);

      console.log(
        `language=${language} rating=${rating} (size ${params.sizeRange[0]}-${params.sizeRange[1]}, ${params.wordCount} words, ` +
          `len ${params.wordLengthRange[0]}-${params.wordLengthRange[1]}, dirs=${params.directions.join('/')}): ` +
          `${LEVELS_PER_RATING - failures}/${LEVELS_PER_RATING} ok, avgAttempts=${avgAttempts}, maxAttempts=${maxAttemptsSeen}, ` +
          `avgWordLength=${avgWordLength.toFixed(1)}`
      );

      if (exampleLevel) {
        console.log(`Example (language=${language}, rating=${rating}, attempts=${exampleAttempts}):`);
        console.log(renderGrid(exampleLevel));
        console.log(`Words: ${exampleLevel.placements.map((p) => `${p.word}(${p.direction})`).join(', ')}`);
        console.log('');
        console.log(JSON.stringify(exampleLevel));
        console.log('');
      }
    }
  }
}

main();
