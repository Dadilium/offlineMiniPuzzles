/**
 * Player-facing difficulty tiers layered on top of each game's adaptive
 * 0-100 `skillRating`. Cutoffs match the bands the generators already split
 * on (`tierKeyFor` in Color Sort / Find Words / Shikaku / Tents & Trees,
 * Cross Sums' `SIZE_TIERS`), so a tier always maps onto a coherent set of
 * generation params. Everything here is pure.
 */
export type DifficultyTier = 'easy' | 'medium' | 'hard' | 'expert';

/** Ordered easiest -> hardest; index doubles as the tier's rank. */
export const DIFFICULTY_TIERS: readonly DifficultyTier[] = ['easy', 'medium', 'hard', 'expert'];

/** Inclusive `[min, max]` rating band per tier. */
export const TIER_BANDS: Readonly<Record<DifficultyTier, readonly [number, number]>> = {
  easy: [0, 39],
  medium: [40, 59],
  hard: [60, 79],
  expert: [80, 100],
};

export function tierRank(tier: DifficultyTier): number {
  return DIFFICULTY_TIERS.indexOf(tier);
}

export function isDifficultyTier(value: unknown): value is DifficultyTier {
  return typeof value === 'string' && (DIFFICULTY_TIERS as readonly string[]).includes(value);
}

export function tierForRating(rating: number): DifficultyTier {
  for (let i = DIFFICULTY_TIERS.length - 1; i >= 0; i--) {
    const tier = DIFFICULTY_TIERS[i];
    if (rating >= TIER_BANDS[tier][0]) return tier;
  }
  return DIFFICULTY_TIERS[0];
}

export function clampToTier(rating: number, tier: DifficultyTier): number {
  const [min, max] = TIER_BANDS[tier];
  return Math.max(min, Math.min(max, rating));
}

/** Lowest rating of the band `rating` falls in -- the floor a generation
 * fallback may relax down to without handing the player an easier tier. */
export function tierFloor(rating: number): number {
  return TIER_BANDS[tierForRating(rating)][0];
}

export function maxTier(a: DifficultyTier, b: DifficultyTier): DifficultyTier {
  return tierRank(a) >= tierRank(b) ? a : b;
}

export function isTierUnlocked(tier: DifficultyTier, unlocked: DifficultyTier): boolean {
  return tierRank(tier) <= tierRank(unlocked);
}

/** The tier directly above `tier`, or null at the top. */
export function nextTier(tier: DifficultyTier): DifficultyTier | null {
  return DIFFICULTY_TIERS[tierRank(tier) + 1] ?? null;
}

/** Rating actually fed to generation and to the skill reducer: the adaptive
 * rating, held inside the band the player picked. */
export function effectiveRating(rating: number, selected: DifficultyTier): number {
  return clampToTier(rating, selected);
}

/** Generated levels the player hasn't completed or skipped yet -- the ones a
 * difficulty switch must regenerate. Completed/skipped levels stay as played. */
export function unplayedLevelIndices(generatedIndices: readonly number[], completed: readonly number[], skipped: readonly number[]): number[] {
  const played = new Set([...completed, ...skipped]);
  return generatedIndices.filter((idx) => !played.has(idx));
}
