// Pure game-logic functions for Shikaku. No React/RN dependencies in this
// file on purpose -- keeps it trivially unit-testable, same as every other
// game's engine.ts.
//
// Bounds convention: `RectBounds` corners are both inclusive cell
// coordinates (r0 <= r <= r1, c0 <= c <= c1), matching a drag-to-draw
// gesture where both corners the player touched are real cells.
import type { Clue, PlacedRect, RectBounds, ShikakuLevel, ShikakuPlayerState } from './types';

export function area(rect: RectBounds): number {
  return (rect.r1 - rect.r0 + 1) * (rect.c1 - rect.c0 + 1);
}

export function containsCell(rect: RectBounds, r: number, c: number): boolean {
  'worklet';
  return r >= rect.r0 && r <= rect.r1 && c >= rect.c0 && c <= rect.c1;
}

export function rectsOverlap(a: RectBounds, b: RectBounds): boolean {
  'worklet';
  return !(a.r1 < b.r0 || b.r1 < a.r0 || a.c1 < b.c0 || b.c1 < a.c0);
}

/** Normalizes two opposite drag corners into a `RectBounds` with r0<=r1, c0<=c1. */
export function rectFromCorners(rA: number, cA: number, rB: number, cB: number): RectBounds {
  'worklet';
  return {
    r0: Math.min(rA, rB),
    c0: Math.min(cA, cB),
    r1: Math.max(rA, rB),
    c1: Math.max(cA, cB),
  };
}

/** Indices into `clues` whose cell falls inside `rect`. */
export function clueIndicesIn(clues: Clue[], rect: RectBounds): number[] {
  'worklet';
  const indices: number[] = [];
  for (let i = 0; i < clues.length; i++) {
    if (containsCell(rect, clues[i].r, clues[i].c)) indices.push(i);
  }
  return indices;
}

/**
 * Grid of which clueIndex owns each cell (-1 if unclaimed). Recomputed fresh
 * each call, no incremental cache -- same style as Kings.
 */
export function computeOwnerGrid(level: ShikakuLevel, placed: ShikakuPlayerState): number[][] {
  const owner = Array.from({ length: level.rows }, () => new Array<number>(level.cols).fill(-1));
  for (const rect of placed) {
    for (let r = rect.r0; r <= rect.r1; r++) {
      for (let c = rect.c0; c <= rect.c1; c++) {
        owner[r][c] = rect.clueIndex;
      }
    }
  }
  return owner;
}

export type PlaceRectResult = { placedRects: ShikakuPlayerState } | { error: 'no-clue' | 'multiple-clues' | 'overlap' };

/**
 * Resolves the single clue `candidate` covers, drops any existing rect for
 * that same clue (a resize-in-place, not a forced delete-first), and rejects
 * outright -- no state change -- on an invalid move shape: 0 or 2+ covered
 * clues, or overlap against every other already-placed rect. Area mismatch
 * against the clue's value is NOT checked here -- that's a recoverable
 * conflict surfaced by `computeConflicts`, not an invalid move.
 */
export function placeRect(level: ShikakuLevel, placed: ShikakuPlayerState, candidate: RectBounds): PlaceRectResult {
  'worklet';
  const clueIndices = clueIndicesIn(level.clues, candidate);
  if (clueIndices.length === 0) return { error: 'no-clue' };
  if (clueIndices.length >= 2) return { error: 'multiple-clues' };

  const clueIndex = clueIndices[0];
  const others = placed.filter((rect) => rect.clueIndex !== clueIndex);
  if (others.some((rect) => rectsOverlap(rect, candidate))) return { error: 'overlap' };

  return { placedRects: [...others, { ...candidate, clueIndex }] };
}

/** Removes the placed rect covering (r, c), if any. No-op otherwise. */
export function removeRectAt(placed: ShikakuPlayerState, r: number, c: number): ShikakuPlayerState {
  return placed.filter((rect) => !containsCell(rect, r, c));
}

/**
 * Clue indices whose placed rect's area doesn't match the clue's value.
 * Overlap and multi-clue coverage are prevented at `placeRect`'s commit
 * time, so they never reach here -- this only ever reports area mismatches.
 */
export function computeConflicts(level: ShikakuLevel, placed: ShikakuPlayerState): Set<number> {
  const conflicts = new Set<number>();
  for (const rect of placed) {
    if (area(rect) !== level.clues[rect.clueIndex].value) conflicts.add(rect.clueIndex);
  }
  return conflicts;
}

/**
 * Every clue placed, zero conflicts, and a full re-derivation of the owner
 * grid confirms every cell is covered -- not just `sum(area) === rows*cols`,
 * which could hide a hole-and-double-count pair (defensive, mirrors
 * Tents & Trees' full-matching re-check rather than trusting a running tally).
 */
export function computeWin(level: ShikakuLevel, placed: ShikakuPlayerState): boolean {
  if (placed.length !== level.clues.length) return false;
  if (computeConflicts(level, placed).size > 0) return false;

  const owner = computeOwnerGrid(level, placed);
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) {
      if (owner[r][c] === -1) return false;
    }
  }
  return true;
}

export interface HintResult {
  placedRects: ShikakuPlayerState;
  clueIndex: number;
}

/**
 * Reveals the first clue (in clue order) whose placed rect doesn't already
 * match `level.solutionRects[i]` -- trusted directly because generation
 * guarantees that partition is the only one satisfying every clue
 * simultaneously. Clears anything overlapping that footprint first (which
 * may belong to a *different* clue, since the correct partition can carve
 * up space the player currently has claimed differently) before dropping in
 * the correct rect. Returns null once every clue already matches.
 */
export function applyHint(level: ShikakuLevel, placed: ShikakuPlayerState): HintResult | null {
  for (let clueIndex = 0; clueIndex < level.clues.length; clueIndex++) {
    const target = level.solutionRects[clueIndex];
    const current = placed.find((rect) => rect.clueIndex === clueIndex);
    const alreadyCorrect =
      current !== undefined &&
      current.r0 === target.r0 &&
      current.c0 === target.c0 &&
      current.r1 === target.r1 &&
      current.c1 === target.c1;
    if (alreadyCorrect) continue;

    const cleared = placed.filter((rect) => !rectsOverlap(rect, target));
    return { placedRects: [...cleared, { ...target, clueIndex }], clueIndex };
  }
  return null;
}
