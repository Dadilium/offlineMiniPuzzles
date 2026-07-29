import type { Tube } from '../types';

export interface PourResult {
  tubes: Tube[];
  amount: number;
  color: number;
}

/**
 * Legal iff `from` is non-empty, `to` is empty or top-color matches, and
 * `to` has room. Moves the whole consecutive top-color run from `from`,
 * capped by `to`'s free space (a pour is never blocked merely because the
 * whole run wouldn't fit -- partial pours are the standard genre rule, not
 * a player choice). Only the two touched tubes are replaced -- the rest of
 * `tubes` keeps the same array references, which matters both for cheap
 * re-renders and for cheap successor generation in `solveColorSort`.
 */
export function pourMove(tubes: Tube[], capacity: number, from: number, to: number): PourResult | null {
  if (from === to) return null;
  const src = tubes[from];
  if (!src || src.length === 0) return null;
  const dst = tubes[to];
  if (!dst) return null;

  const topColor = src[src.length - 1];
  const space = capacity - dst.length;
  if (space <= 0) return null;
  if (dst.length > 0 && dst[dst.length - 1] !== topColor) return null;

  let runLength = 1;
  while (runLength < src.length && src[src.length - 1 - runLength] === topColor) runLength++;
  const amount = Math.min(runLength, space);

  const nextTubes = tubes.slice();
  nextTubes[from] = src.slice(0, src.length - amount);
  nextTubes[to] = dst.concat(src.slice(src.length - amount));
  return { tubes: nextTubes, amount, color: topColor };
}

/**
 * Win iff every tube is empty or full-capacity single-color -- NOT just
 * "every non-empty tube monochrome", which would wrongly accept one color
 * split monochrome-but-partial across two different tubes.
 */
export function computeWin(tubes: Tube[], capacity: number): boolean {
  return tubes.every((t) => t.length === 0 || (t.length === capacity && t.every((c) => c === t[0])));
}

/**
 * Canonical visited-set key: two tubes with byte-identical contents (in
 * particular, any two empty tubes) are interchangeable for solvability, so
 * sorting collapses index-permuted-but-otherwise-identical states into one
 * key. Shared with fingerprint.ts so the two can't drift apart.
 */
export function canonicalKey(tubes: Tube[]): string {
  return tubes
    .map((t) => t.join(','))
    .sort()
    .join('|');
}

export interface Move {
  from: number;
  to: number;
}

export interface SolveResult {
  solvable: boolean;
  /** Shortest solution path found, or null if unsolvable/inconclusive. */
  moves: Move[] | null;
  statesExplored: number;
  /**
   * True iff the search hit `maxStates` before exhausting the space --
   * `solvable: false` in that case is NOT proof of unsolvability. Callers
   * (generation rejection, runtime isStuck) must treat this as "unknown",
   * never coerce it into either boolean outcome.
   */
  truncated: boolean;
}

const DEFAULT_MAX_STATES = 200_000;

/**
 * BFS/shortest-path over the move graph (not backtracking-with-a-solution-
 * cap like Cross Sums -- this is a move-SEQUENCE puzzle, so the question is
 * reachability, not "how many solutions exist"). The queue always carries
 * a concrete, positional `tubes` array derived by literally applying
 * `pourMove` from the start -- canonicalization is only a Set<string> lens
 * over the visited set, so a returned move's `{from, to}` indices are
 * directly replayable against the real board (for hints).
 *
 * The only pruning applied is collapsing "pour `from` into any currently-
 * empty tube" to a single representative per `from` -- those all produce a
 * canonically identical result, so trying more than one is pure waste. This
 * is reset per `from` (NOT shared across the whole state), since pouring
 * from a *different* source into an empty tube is a distinct, unexplored
 * move. Deliberately does NOT prune "never pour out of a completed tube" --
 * that exchange-argument prune couldn't be established as sound for every
 * board (a completed tube's freed slots could be the only spare scratch
 * space available), and a false negative here would be a visible bug, not
 * just a wasted attempt.
 */
export function solveColorSort(tubes: Tube[], capacity: number, opts: { maxStates?: number } = {}): SolveResult {
  const maxStates = opts.maxStates ?? DEFAULT_MAX_STATES;
  if (computeWin(tubes, capacity)) return { solvable: true, moves: [], statesExplored: 0, truncated: false };

  const visited = new Set<string>([canonicalKey(tubes)]);
  const queue: Array<{ tubes: Tube[]; moves: Move[] }> = [{ tubes, moves: [] }];
  let explored = 0;
  let head = 0;

  while (head < queue.length) {
    const { tubes: cur, moves } = queue[head++];
    explored++;
    if (explored > maxStates) return { solvable: false, moves: null, statesExplored: explored, truncated: true };

    for (let from = 0; from < cur.length; from++) {
      if (cur[from].length === 0) continue;
      let sawEmptyDest = false;

      for (let to = 0; to < cur.length; to++) {
        if (to === from) continue;
        if (cur[to].length === 0) {
          if (sawEmptyDest) continue;
          sawEmptyDest = true;
        }

        const result = pourMove(cur, capacity, from, to);
        if (!result) continue;

        if (computeWin(result.tubes, capacity)) {
          return { solvable: true, moves: moves.concat({ from, to }), statesExplored: explored, truncated: false };
        }

        const key = canonicalKey(result.tubes);
        if (visited.has(key)) continue;
        visited.add(key);
        queue.push({ tubes: result.tubes, moves: moves.concat({ from, to }) });
      }
    }
  }

  return { solvable: false, moves: null, statesExplored: explored, truncated: false };
}
