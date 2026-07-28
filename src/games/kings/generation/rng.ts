export type RNG = () => number;

/** Small, fast, seeded PRNG (mulberry32) -- deterministic given the same seed. */
export function mulberry32(seed: number): RNG {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Derives a 32-bit seed from a level index (+ optional salt) via a
 * murmur3-style integer finalizer -- good enough to spread consecutive level
 * indices across the PRNG's output space without visible correlation.
 */
export function seedFromLevelIndex(levelIndex: number, salt = 0): number {
  let h = ((levelIndex + 1) * 2654435761 + salt * 40503) | 0;
  h = Math.imul(h ^ (h >>> 16), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  h ^= h >>> 16;
  return h >>> 0;
}
