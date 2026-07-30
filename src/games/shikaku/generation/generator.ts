import { area } from '../engine';
import type { Clue, RectBounds, ShikakuLevel } from '../types';
import type { GenerationParams } from './difficulty';
import { fingerprintShikaku } from './fingerprint';
import type { RNG } from './rng';
import { solveShikaku } from './solver';

export interface GenerateSuccess {
  level: ShikakuLevel;
  attempts: number;
  fingerprint: string;
}

export interface GenerateFailure {
  attempts: number;
}

function randInt(rng: RNG, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/**
 * A rectangle of area 1 is a clue with only one possible placement (the
 * cell itself) -- it conveys zero solving information, which reads as a
 * "useless" clue rather than a puzzle element. This is a hard floor
 * (never violated), independent of the tier-tunable `minRectArea` soft
 * target below (which is itself already >=2 in every tier, but this stays
 * true even if that ever changed).
 */
const MIN_LEAF_AREA = 2;

/** Minimum units along a cut axis so that `units * otherDim >= requiredArea`. */
function minUnitsForArea(otherDim: number, requiredArea: number): number {
  return Math.max(1, Math.ceil(requiredArea / otherDim));
}

/** True if a `length`-long, `otherDim`-wide region can be cut into two sides that both reach at least `requiredArea`. */
function canSplitAboveArea(length: number, otherDim: number, requiredArea: number): boolean {
  const minUnits = minUnitsForArea(otherDim, requiredArea);
  return minUnits * 2 <= length;
}

/**
 * Soft target (on top of the hard `MIN_LEAF_AREA` floor enforced by the
 * caller): steers away from splits that would create a side smaller than
 * `minRectArea` in area OR narrower than 2 units along the cut dimension (a
 * 1-wide side is a sliver regardless of its total area, e.g. a 1x5 strip)
 * whenever the region is large enough to avoid both -- otherwise a uniform
 * split position frequently slices off a bare 1-row/1-col sliver, which is
 * what made early, unweighted subdivision attempts produce boards that were
 * almost entirely slivers.
 */
function sliverAvoidingMinUnits(otherDim: number, minRectArea: number): number {
  return Math.max(2, Math.ceil(minRectArea / otherDim));
}

/**
 * How often `pickSplitOffset` deliberately peels a thin (hard-floor-only)
 * slice off one side instead of taking its squarish/no-sliver preference.
 * Without this, that preference wins *every* time it's geometrically
 * possible, which doesn't just reduce slivers -- it eliminates essentially
 * all flat/elongated leaf shapes outright (e.g. every area-4 leaf ends up
 * 2x2, never 1x4; every area-6 leaf ends up 2x3, never 1x6). Real Shikaku
 * boards mix both: mostly squarish pieces with flat ones as genuine, less
 * common variety, not absent entirely. This is independent of
 * `MIN_LEAF_AREA` -- it only trades off against the *nicer* target, never
 * against the hard floor.
 */
const THIN_CUT_PROBABILITY = 0.25;

/**
 * Picks where along a `length`-long dimension (with the perpendicular
 * dimension fixed at `otherDim`) to guillotine-cut, in [1, length-1] (the
 * count of rows/cols that go to the first side). `THIN_CUT_PROBABILITY` of
 * the time, deliberately peels the minimum hard-safe slice off a random
 * side (producing a flat/elongated sub-region on that side, which may then
 * itself become -- or subdivide further into -- a flat final leaf); the
 * rest of the time prefers the soft `minRectArea`/no-sliver target when
 * the region is large enough to support it, falling back to a uniform pick
 * over the wider hard-`MIN_LEAF_AREA`-only range otherwise. The hard range
 * used in both branches is guaranteed non-empty -- the caller (`subdivide`)
 * has already confirmed this axis can reach `MIN_LEAF_AREA` on both sides
 * before ever calling this function.
 */
function pickSplitOffset(rng: RNG, length: number, otherDim: number, minRectArea: number): number {
  const hardUnits = minUnitsForArea(otherDim, MIN_LEAF_AREA);

  if (rng() < THIN_CUT_PROBABILITY) {
    return rng() < 0.5 ? hardUnits : length - hardUnits;
  }

  const niceUnits = sliverAvoidingMinUnits(otherDim, minRectArea);
  const niceLo = niceUnits;
  const niceHi = length - niceUnits;
  if (niceLo <= niceHi) return niceLo + Math.floor(rng() * (niceHi - niceLo + 1));

  const hardLo = hardUnits;
  const hardHi = length - hardUnits;
  return hardLo + Math.floor(rng() * (hardHi - hardLo + 1));
}

/** True if cutting a `length`-long, `otherDim`-wide region has room to give both sides at least 2 units (no sliver) and at least `minRectArea` (per `pickSplitOffset`'s same rule). */
function canSplitWithoutSliver(length: number, otherDim: number, minRectArea: number): boolean {
  const minUnits = sliverAvoidingMinUnits(otherDim, minRectArea);
  return minUnits * 2 <= length;
}

/**
 * Recursively splits [r0..r1] x [c0..c1] (inclusive) with guillotine cuts --
 * every cut runs the full length of the region it splits, so the result is
 * always a valid rectangle partition (no T-joints) -- until each leaf is
 * accepted as-is.
 *
 * A leaf's area never drops below `MIN_LEAF_AREA` (2) -- a hard rule, not a
 * preference: before ever deciding to cut, this checks whether *any* cut
 * along either axis could still leave both resulting sides at or above that
 * floor (`canSplitAboveArea`); if neither axis can, the region is accepted
 * as one leaf outright, even if that leaves it above `maxRectArea` (a big
 * clue is still a usable clue; a value-1 clue is not). Only once that's
 * confirmed does the softer `minRectArea`/`maxRectArea` difficulty tuning
 * kick in: whether to stop is a soft target (probability ramps up from
 * `minRectArea` towards `maxRectArea`), and crossing `maxRectArea` forces a
 * cut outright, but *which* cut gets made (`pickSplitOffset`) always stays
 * within the hard-safe range, falling back from the nicer sliver-avoiding
 * target to the bare hard floor only when the nicer one isn't reachable.
 * The sweep script's "sliver fraction" stat tracks 1-wide-but-still->=2-area
 * strips, which are still allowed (unlike area-1 leaves) since they're
 * a valid, if less balanced-looking, board texture.
 *
 * The cut direction first prefers whichever axis `canSplitWithoutSliver`
 * up front (e.g. a 2-row-tall, 6-col-wide band can only be cut vertically
 * without immediately producing two 1-row slivers, so it always is, until
 * its width also shrinks to a safe-to-cut size); when both or neither axis
 * is sliver-safe it falls back to biasing towards the region's longer
 * dimension, which keeps leaves closer to square.
 */
export function subdivide(
  rng: RNG,
  r0: number,
  c0: number,
  r1: number,
  c1: number,
  minRectArea: number,
  maxRectArea: number,
  out: RectBounds[]
): void {
  const height = r1 - r0 + 1;
  const width = c1 - c0 + 1;

  const hardHorizontalSafe = height >= 2 && canSplitAboveArea(height, width, MIN_LEAF_AREA);
  const hardVerticalSafe = width >= 2 && canSplitAboveArea(width, height, MIN_LEAF_AREA);

  if (!hardHorizontalSafe && !hardVerticalSafe) {
    out.push({ r0, c0, r1, c1 });
    return;
  }

  const leafArea = height * width;
  const mustCut = leafArea > maxRectArea;
  if (!mustCut) {
    const stopProbability =
      leafArea <= minRectArea
        ? 0.65
        : 0.65 + 0.35 * Math.min(1, (leafArea - minRectArea) / Math.max(1, maxRectArea - minRectArea));
    if (rng() < stopProbability) {
      out.push({ r0, c0, r1, c1 });
      return;
    }
  }

  const horizontalNice = hardHorizontalSafe && canSplitWithoutSliver(height, width, minRectArea);
  const verticalNice = hardVerticalSafe && canSplitWithoutSliver(width, height, minRectArea);

  let cutHorizontally: boolean;
  if (horizontalNice && !verticalNice) {
    cutHorizontally = true;
  } else if (verticalNice && !horizontalNice) {
    cutHorizontally = false;
  } else if (hardHorizontalSafe && hardVerticalSafe) {
    cutHorizontally = height >= width ? rng() < 0.7 : rng() < 0.3;
  } else {
    cutHorizontally = hardHorizontalSafe;
  }

  if (cutHorizontally) {
    const h1 = pickSplitOffset(rng, height, width, minRectArea);
    const rowSplit = r0 + h1;
    subdivide(rng, r0, c0, rowSplit - 1, c1, minRectArea, maxRectArea, out);
    subdivide(rng, rowSplit, c0, r1, c1, minRectArea, maxRectArea, out);
  } else {
    const w1 = pickSplitOffset(rng, width, height, minRectArea);
    const colSplit = c0 + w1;
    subdivide(rng, r0, c0, r1, colSplit - 1, minRectArea, maxRectArea, out);
    subdivide(rng, r0, colSplit, r1, c1, minRectArea, maxRectArea, out);
  }
}

/**
 * Constructs a solved partition directly (the subdivision IS the solution's
 * rectangles, one random cell per leaf becomes its clue), then still runs
 * `solveShikaku(level, 2)` and requires exactly one solution before
 * accepting -- construction alone does not guarantee uniqueness, since a
 * different tiling can sometimes satisfy the same clue cells/values (e.g. a
 * clue of value 6 might factor as 2x3 in more than one position once other
 * clues are laid out around it). This uniqueness check is load-bearing, per
 * CLAUDE.md's "never fall back to a lesser [ambiguous] solution" -- matches
 * the Tents & Trees/Cross Sums precedent, in contrast to Block Fill's
 * generator, whose mechanic never needed a uniqueness guarantee in the first
 * place. Same pure, seeded rejection-sampling shape as those generators:
 * keep drawing fresh random boards from the same `rng` stream until one
 * both dedupes against `recentFingerprints` and passes the uniqueness check,
 * or give up after `maxAttempts`.
 */
export function generateShikakuLevel(
  rng: RNG,
  params: GenerationParams,
  recentFingerprints: string[] = [],
  maxAttempts = 4000
): GenerateSuccess | GenerateFailure {
  const recent = new Set(recentFingerprints);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const rows = randInt(rng, params.rowsRange[0], params.rowsRange[1]);
    const cols = randInt(rng, params.colsRange[0], params.colsRange[1]);
    const minRectArea = randInt(rng, params.minRectArea[0], params.minRectArea[1]);
    const maxRectArea = Math.max(minRectArea, randInt(rng, params.maxRectArea[0], params.maxRectArea[1]));

    const leaves: RectBounds[] = [];
    subdivide(rng, 0, 0, rows - 1, cols - 1, minRectArea, maxRectArea, leaves);

    // Defensive re-check, not load-bearing under normal operation --
    // `subdivide`'s hard `MIN_LEAF_AREA` gate should make this impossible,
    // but a useless value-1 clue slipping through would be worse than one
    // extra generation attempt, so it's cheap insurance against any future
    // edge case in that logic.
    if (leaves.some((leaf) => area(leaf) < MIN_LEAF_AREA)) continue;

    const clues: Clue[] = leaves.map((leaf) => ({
      r: randInt(rng, leaf.r0, leaf.r1),
      c: randInt(rng, leaf.c0, leaf.c1),
      value: area(leaf),
    }));

    const fingerprint = fingerprintShikaku(rows, cols, clues);
    if (recent.has(fingerprint)) continue;

    const level: ShikakuLevel = { rows, cols, clues, solutionRects: leaves };
    const solutions = solveShikaku(level, 2);
    if (solutions.length !== 1) continue;

    return { level, attempts: attempt, fingerprint };
  }

  return { attempts: maxAttempts };
}
