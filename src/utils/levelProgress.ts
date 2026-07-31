import type { LevelListItem, LevelStatus } from '../components/LevelList';

/** Levels are generated on demand, not a fixed list -- play is strictly
 * sequential (each level unlocks the next), so completed+skipped is exactly
 * the count of levels reached so far, and the one right after them is the
 * next available one. */
export function getResumeIndex(levelsCompleted: Set<number>, levelsSkipped: Set<number>): number {
  return levelsCompleted.size + levelsSkipped.size;
}

/** Builds the Levels-screen row list up to and including the next available
 * level -- nothing beyond that needs a row. */
export function buildSequentialLevelItems(
  levelsCompleted: Set<number>,
  levelsSkipped: Set<number>,
  titleFor: (index: number) => string
): LevelListItem[] {
  const frontier = getResumeIndex(levelsCompleted, levelsSkipped);
  const items: LevelListItem[] = [];
  for (let idx = 0; idx <= frontier; idx++) {
    const complete = levelsCompleted.has(idx);
    const skipped = levelsSkipped.has(idx);
    const status: LevelStatus = complete ? 'complete' : skipped ? 'skipped' : 'available';
    items.push({ title: titleFor(idx), status });
  }
  return items;
}
