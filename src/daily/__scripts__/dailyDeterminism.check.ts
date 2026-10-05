/**
 * Proves the Daily Puzzle is the same board on every device: builds each
 * game's daily for a full week (one of every weekday tier) twice, from a
 * cold start each time, and asserts identical fingerprints. Also prints how
 * long each build took -- the number to watch for Kings at Expert, since
 * dailies run with no wall-clock deadline (a device-speed-dependent cutoff
 * would hand slower phones a different board).
 *
 * Mirrors each game's daily store generator exactly (see the
 * `toDailyStoreConfig` call in each game's state/use*Progress.ts) -- keep
 * the two in sync when adding a game.
 *
 * Run with: npx tsx src/daily/__scripts__/dailyDeterminism.check.ts [firstDay] [days]
 *   e.g. npx tsx src/daily/__scripts__/dailyDeterminism.check.ts 5 7
 *   (day 5 = Monday 2026-10-05, so 5..11 covers Mon-Sun)
 * Optionally filter games: GAMES=kings,arrows npx tsx ...
 */
import { dailyFromRobust } from '../dailyStore';
import { dailyRating, dailySeedIndex, dayKeyForNumber, tierForDayNumber } from '../calendar';
import * as arrows from '../../games/arrows/generation';
import * as blockFill from '../../games/block-fill/generation';
import * as colorSort from '../../games/color-sort/generation';
import * as crossSums from '../../games/cross-sums/generation';
import * as findWords from '../../games/find-words/generation';
import * as kings from '../../games/kings/generation';
import * as matchingNumbers from '../../games/matching-numbers/generation';
import * as shikaku from '../../games/shikaku/generation';
import * as tentsAndTrees from '../../games/tents-and-trees/generation';

interface DailyGame {
  id: string;
  build: (dayNumber: number) => unknown;
  fingerprint: (level: any) => string;
}

const GAMES: DailyGame[] = [
  {
    id: 'shikaku',
    build: dailyFromRobust((idx, r, recent) => shikaku.createLevelForIndexRobust(idx, r as shikaku.SkillRating, recent)),
    fingerprint: (l) => shikaku.fingerprintShikaku(l.rows, l.cols, l.clues),
  },
  {
    id: 'kings',
    build: (day) => kings.createDailyLevel(dailySeedIndex(day), dailyRating(tierForDayNumber(day)) as kings.SkillRating),
    fingerprint: (l) => kings.fingerprintRegions(l.regions),
  },
  {
    id: 'arrows',
    build: dailyFromRobust((idx, r, recent) => arrows.createLevelForIndexRobustAsync(idx, r as arrows.SkillRating, recent)),
    fingerprint: (l) => arrows.fingerprintArrows(l),
  },
  {
    id: 'block-fill',
    build: dailyFromRobust((idx, r, recent) => blockFill.createLevelForIndexRobust(idx, r as blockFill.SkillRating, recent)),
    fingerprint: (l) => blockFill.fingerprintBlockFill(l.fillable),
  },
  {
    id: 'color-sort',
    build: dailyFromRobust((idx, r, recent) => colorSort.createLevelForIndexRobust(idx, r as colorSort.SkillRating, recent)),
    fingerprint: (l) => colorSort.fingerprintColorSort(l.tubes, l.capacity),
  },
  {
    id: 'cross-sums',
    build: dailyFromRobust((idx, r, recent) => crossSums.createLevelForIndexRobust(idx, r as crossSums.SkillRating, recent)),
    fingerprint: (l) => crossSums.fingerprintCrossSums(l.grid, l.rowTargets, l.colTargets),
  },
  ...(['en', 'fr'] as const).map(
    (lang): DailyGame => ({
      id: `find-words(${lang})`,
      build: dailyFromRobust((idx, r, recent) => findWords.createLevelForIndexRobust(idx, r as findWords.SkillRating, lang, recent, [])),
      fingerprint: (l) => findWords.fingerprintFindWords(l.rows, l.cols, l.placements),
    })
  ),
  {
    id: 'matching-numbers',
    build: dailyFromRobust((idx, r, recent) => matchingNumbers.createLevelForIndexRobust(idx, r as matchingNumbers.SkillRating, recent)),
    fingerprint: (l) => matchingNumbers.fingerprintGrid(l.grid),
  },
  {
    id: 'tents-and-trees',
    build: dailyFromRobust((idx, r, recent) => tentsAndTrees.createLevelForIndexRobust(idx, r as tentsAndTrees.SkillRating, recent)),
    fingerprint: (l) => tentsAndTrees.fingerprintTentsAndTrees(l.trees, l.rowTargets, l.colTargets),
  },
];

// Script-only globals -- the app tsconfig has no Node types.
declare const process: { argv: string[]; env: Record<string, string | undefined> };

async function timed(build: () => unknown): Promise<{ level: unknown; ms: number }> {
  const start = Date.now();
  const level = await build();
  return { level, ms: Date.now() - start };
}

async function main() {
  const firstDay = Number(process.argv[2] ?? 5);
  const days = Number(process.argv[3] ?? 7);
  const only = process.env.GAMES?.split(',');
  const games = only ? GAMES.filter((g) => only.some((o) => g.id.startsWith(o))) : GAMES;

  let failed = 0;
  for (const game of games) {
    console.log(`\n${game.id}`);
    // A board repeating across days means generation is landing on a fixed
    // fallback (e.g. safeBoards) instead of the day's own seed.
    const seen = new Map<string, number>();
    for (let day = firstDay; day < firstDay + days; day++) {
      const label = `#${day} ${dayKeyForNumber(day)} ${tierForDayNumber(day).padEnd(6)}`;
      try {
        const a = await timed(() => game.build(day));
        const b = await timed(() => game.build(day));
        const fp = game.fingerprint(a.level);
        const same = fp === game.fingerprint(b.level);
        const repeatOf = seen.get(fp);
        seen.set(fp, day);
        if (!same || repeatOf !== undefined) failed += 1;
        const note = !same ? ' (differs between builds)' : repeatOf !== undefined ? ` (same board as #${repeatOf})` : '';
        console.log(`  ${same && repeatOf === undefined ? 'ok  ' : 'FAIL'} ${label} ${String(a.ms).padStart(6)}ms / ${String(b.ms).padStart(6)}ms${note}`);
      } catch (err) {
        failed += 1;
        console.log(`  FAIL ${label} threw: ${(err as Error).message}`);
      }
    }
  }
  console.log(failed === 0 ? '\nall dailies deterministic' : `\n${failed} daily check(s) failed`);
  if (failed > 0) throw new Error(`${failed} daily determinism check(s) failed`);
}

void main();
