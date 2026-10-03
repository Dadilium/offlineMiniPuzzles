import type { ProgressState } from './createProgressStore';
import {
  type DifficultyTier,
  isDifficultyTier,
  isTierUnlocked,
  maxTier,
  tierForRating,
  tierRank,
  unplayedLevelIndices,
} from './difficultyTiers';

/**
 * Pure state transitions for the difficulty layer of `createProgressStore`,
 * kept out of the React provider so they can be exercised directly (see
 * `__scripts__/difficultyTiers.check.ts`). Type-only import above -- this
 * module pulls in no React/AsyncStorage at runtime.
 */

type ResetLevelCustom<TLevel, TCustom> = (custom: TCustom, level: TLevel, levelIndex: number) => TCustom;

interface PersistedTiers {
  selectedTier: DifficultyTier;
  unlockedTier: DifficultyTier;
  seenUnlockedTier: DifficultyTier;
}

/** Validates persisted tier fields, back-filling saves from before tiers
 * existed from the rating already earned -- nobody loses progress or gets
 * bumped to an easier tier on update. */
export function resolvePersistedTiers(raw: Partial<Record<keyof PersistedTiers, unknown>>, skillRating: number): PersistedTiers {
  const ratingTier = tierForRating(skillRating);
  const unlockedTier = maxTier(isDifficultyTier(raw.unlockedTier) ? raw.unlockedTier : ratingTier, ratingTier);
  const selectedTier = isDifficultyTier(raw.selectedTier) && isTierUnlocked(raw.selectedTier, unlockedTier) ? raw.selectedTier : ratingTier;
  const seenUnlockedTier = isDifficultyTier(raw.seenUnlockedTier) ? raw.seenUnlockedTier : unlockedTier;
  return { selectedTier, unlockedTier, seenUnlockedTier };
}

/** Applies a new rating and unlocks whatever tier it reaches, leaving
 * `selectedTier` alone (see `withRatingAndAutoSwitch` for the switch). */
export function withRating<TLevel, TCustom>(base: ProgressState<TLevel, TCustom>, skillRating: number): ProgressState<TLevel, TCustom> {
  return { ...base, skillRating, unlockedTier: maxTier(base.unlockedTier, tierForRating(skillRating)) };
}

/** Applies a new rating; if that unlocks a harder tier, moves the player
 * straight onto it (regenerating every unplayed level there) so the very
 * next level is at the new difficulty. Unlocks only happen while playing
 * the hardest unlocked tier -- the rating is held inside the selected band --
 * so this never overrides a deliberate pick of an easier step. */
export function withRatingAndAutoSwitch<TLevel, TCustom>(
  base: ProgressState<TLevel, TCustom>,
  skillRating: number,
  resetLevelCustom: ResetLevelCustom<TLevel, TCustom>
): { state: ProgressState<TLevel, TCustom>; switched: boolean } {
  const rated = withRating(base, skillRating);
  if (tierRank(rated.unlockedTier) <= tierRank(base.unlockedTier)) return { state: rated, switched: false };
  return { state: withTierSwitch(rated, rated.unlockedTier, resetLevelCustom), switched: true };
}

/** Selects `tier` and drops every unplayed level (board progress and hint
 * counts included) so each regenerates at the new difficulty. Completed and
 * skipped levels are kept exactly as played. */
export function withTierSwitch<TLevel, TCustom>(
  base: ProgressState<TLevel, TCustom>,
  tier: DifficultyTier,
  resetLevelCustom: ResetLevelCustom<TLevel, TCustom>
): ProgressState<TLevel, TCustom> {
  const indices = Object.keys(base.generatedLevels).map(Number);
  const unplayed = unplayedLevelIndices(indices, base.levelsCompleted, base.levelsSkipped);
  const generatedLevels = { ...base.generatedLevels };
  const hintsUsedByLevel = { ...base.hintsUsedByLevel };
  let custom = base.custom;
  for (const idx of unplayed) {
    custom = resetLevelCustom(custom, base.generatedLevels[idx], idx);
    delete generatedLevels[idx];
    delete hintsUsedByLevel[idx];
  }
  return { ...base, selectedTier: tier, generatedLevels, hintsUsedByLevel, custom };
}

/** A level counts as started once a hint was spent on it or its `custom`
 * slot differs from a fresh reset -- generic across games since
 * `resetLevelCustom` already knows what "untouched" looks like for each. */
export function isLevelTouched<TLevel, TCustom>(
  base: ProgressState<TLevel, TCustom>,
  levelIndex: number,
  resetLevelCustom: ResetLevelCustom<TLevel, TCustom>
): boolean {
  const level = base.generatedLevels[levelIndex];
  if (!level) return false;
  if ((base.hintsUsedByLevel[levelIndex] ?? 0) > 0) return true;
  try {
    return JSON.stringify(resetLevelCustom(base.custom, level, levelIndex)) !== JSON.stringify(base.custom);
  } catch {
    return true;
  }
}
