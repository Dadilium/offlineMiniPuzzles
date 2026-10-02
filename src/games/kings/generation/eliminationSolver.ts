import type { KingsLevel } from '../types';

/** Hardest technique a board needed: hidden singles only, plus locked
 * candidates, or plus one-step lookahead. */
export type ReasoningTier = 'easy' | 'medium' | 'hard';

export interface EliminationResult {
  /** True if the board fully resolves via pure deduction, with no guessing. */
  solved: boolean;
  positions: Array<{ r: number; c: number }>;
  /** Set when `solved` is false: how far it got before running out of moves. */
  stuckReason?: string;
  /** Whether the locked-candidates pass ever contributed a deduction (hidden
   * singles alone weren't enough) -- the difficulty-tier signal. */
  usedLockedCandidates: boolean;
  /** Whether one-step lookahead ("a king here would leave some row, column
   * or region with no cell left") was ever needed. */
  usedLookahead: boolean;
  tier: ReasoningTier;
  /** How many fixed-point loop iterations it took to finish (or get stuck) --
   * a continuous "how much reasoning" signal within a tier. */
  rounds: number;
}

/**
 * Mimics how a person actually solves these boards -- repeatedly applies
 * "only one legal cell left in this row/column/region -> place a king
 * there" (hidden singles), "this region's remaining candidates all sit
 * in one row/column (or vice versa) -> the other cells in that line/region
 * can't hold a king" (locked candidates), and -- only once both are stuck --
 * "a king here would wipe out every remaining cell of some other row, column
 * or region, so it can't go here" (one-step lookahead, the go-to move for
 * larger boards), looping to a fixed point. If it
 * fully places all `n` kings this way, the level is solvable without ever
 * having to guess-and-backtrack. All three are "safe": they only ever
 * eliminate cells that can be proven impossible, never the true solution --
 * so this should never contradict a level `solveKings` already confirmed
 * has exactly one solution.
 */
export function solveByElimination(level: KingsLevel): EliminationResult {
  const n = level.n;
  const regions = level.regions;
  const candidates: boolean[][] = Array.from({ length: n }, () => Array(n).fill(true));
  const rowDone = Array(n).fill(false);
  const colDone = Array(n).fill(false);
  const regionDone = Array(n).fill(false);
  const positions: Array<{ r: number; c: number }> = [];
  let usedLockedCandidates = false;
  let usedLookahead = false;
  let rounds = 0;
  const wiped = new Int32Array(n * n);
  let wipeStamp = 0;

  function rowCandidates(r: number): number[] {
    const cols: number[] = [];
    for (let c = 0; c < n; c++) if (candidates[r][c]) cols.push(c);
    return cols;
  }
  function colCandidates(c: number): number[] {
    const rows: number[] = [];
    for (let r = 0; r < n; r++) if (candidates[r][c]) rows.push(r);
    return rows;
  }
  function regionCandidates(rid: number): Array<{ r: number; c: number }> {
    const cells: Array<{ r: number; c: number }> = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (regions[r][c] === rid && candidates[r][c]) cells.push({ r, c });
    return cells;
  }

  function place(r: number, c: number): void {
    positions.push({ r, c });
    rowDone[r] = true;
    colDone[c] = true;
    regionDone[regions[r][c]] = true;
    for (let cc = 0; cc < n; cc++) if (cc !== c) candidates[r][cc] = false;
    for (let rr = 0; rr < n; rr++) if (rr !== r) candidates[rr][c] = false;
    const rid = regions[r][c];
    for (let rr = 0; rr < n; rr++) {
      for (let cc = 0; cc < n; cc++) {
        if (regions[rr][cc] === rid && !(rr === r && cc === c)) candidates[rr][cc] = false;
      }
    }
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const rr = r + dr;
        const cc = c + dc;
        if (rr >= 0 && rr < n && cc >= 0 && cc < n) candidates[rr][cc] = false;
      }
    }
  }

  let changed = true;
  let contradiction = false;

  while (changed && !contradiction) {
    changed = false;
    rounds++;

    // Hidden singles: row / column / region.
    for (let r = 0; r < n && !contradiction; r++) {
      if (rowDone[r]) continue;
      const cols = rowCandidates(r);
      if (cols.length === 0) contradiction = true;
      else if (cols.length === 1) {
        place(r, cols[0]);
        changed = true;
      }
    }
    for (let c = 0; c < n && !contradiction; c++) {
      if (colDone[c]) continue;
      const rows = colCandidates(c);
      if (rows.length === 0) contradiction = true;
      else if (rows.length === 1) {
        place(rows[0], c);
        changed = true;
      }
    }
    for (let rid = 0; rid < n && !contradiction; rid++) {
      if (regionDone[rid]) continue;
      const cells = regionCandidates(rid);
      if (cells.length === 0) contradiction = true;
      else if (cells.length === 1) {
        place(cells[0].r, cells[0].c);
        changed = true;
      }
    }
    if (contradiction || changed) continue; // re-run hidden singles before trying locked candidates

    // Locked candidates: a region confined to one row/column means the
    // *other* regions can't use that row/column; a row/column confined to
    // one region means that region's king can't be anywhere else.
    for (let rid = 0; rid < n; rid++) {
      if (regionDone[rid]) continue;
      const cells = regionCandidates(rid);
      if (cells.length === 0) continue;
      const rows = new Set(cells.map((p) => p.r));
      if (rows.size === 1) {
        const r = cells[0].r;
        for (let c = 0; c < n; c++) {
          if (candidates[r][c] && regions[r][c] !== rid) {
            candidates[r][c] = false;
            changed = true;
            usedLockedCandidates = true;
          }
        }
      }
      const cols = new Set(cells.map((p) => p.c));
      if (cols.size === 1) {
        const c = cells[0].c;
        for (let r = 0; r < n; r++) {
          if (candidates[r][c] && regions[r][c] !== rid) {
            candidates[r][c] = false;
            changed = true;
            usedLockedCandidates = true;
          }
        }
      }
    }
    for (let r = 0; r < n; r++) {
      if (rowDone[r]) continue;
      const cols = rowCandidates(r);
      if (cols.length === 0) continue;
      const rids = new Set(cols.map((c) => regions[r][c]));
      if (rids.size === 1) {
        const rid = cols.length > 0 ? regions[r][cols[0]] : -1;
        for (let rr = 0; rr < n; rr++) {
          for (let cc = 0; cc < n; cc++) {
            if (rr !== r && regions[rr][cc] === rid && candidates[rr][cc]) {
              candidates[rr][cc] = false;
              changed = true;
              usedLockedCandidates = true;
            }
          }
        }
      }
    }
    for (let c = 0; c < n; c++) {
      if (colDone[c]) continue;
      const rows = colCandidates(c);
      if (rows.length === 0) continue;
      const rids = new Set(rows.map((r) => regions[r][c]));
      if (rids.size === 1) {
        const rid = rows.length > 0 ? regions[rows[0]][c] : -1;
        for (let rr = 0; rr < n; rr++) {
          for (let cc = 0; cc < n; cc++) {
            if (cc !== c && regions[rr][cc] === rid && candidates[rr][cc]) {
              candidates[rr][cc] = false;
              changed = true;
              usedLockedCandidates = true;
            }
          }
        }
      }
    }
    if (changed) continue; // re-run the cheaper techniques before lookahead

    // One-step lookahead: rule out any candidate whose placement would
    // leave another unfinished row, column or region with zero candidates.
    for (let r = 0; r < n; r++) {
      if (rowDone[r]) continue;
      for (let c = 0; c < n; c++) {
        if (!candidates[r][c]) continue;
        if (placementEmptiesAUnit(r, c)) {
          candidates[r][c] = false;
          changed = true;
          usedLookahead = true;
        }
      }
    }
  }

  /** Whether placing a king at (r, c) would leave some other unfinished
   * row/column/region with no candidate cell. */
  function placementEmptiesAUnit(r: number, c: number): boolean {
    const stamp = ++wipeStamp;
    const rid = regions[r][c];
    for (let rr = 0; rr < n; rr++) {
      for (let cc = 0; cc < n; cc++) {
        if (!candidates[rr][cc]) continue;
        if (rr === r || cc === c || regions[rr][cc] === rid || (Math.abs(rr - r) <= 1 && Math.abs(cc - c) <= 1)) wiped[rr * n + cc] = stamp;
      }
    }
    const alive = (rr: number, cc: number) => candidates[rr][cc] && wiped[rr * n + cc] !== stamp;

    for (let rr = 0; rr < n; rr++) {
      if (rr === r || rowDone[rr]) continue;
      let any = false;
      for (let cc = 0; cc < n && !any; cc++) any = alive(rr, cc);
      if (!any) return true;
    }
    for (let cc = 0; cc < n; cc++) {
      if (cc === c || colDone[cc]) continue;
      let any = false;
      for (let rr = 0; rr < n && !any; rr++) any = alive(rr, cc);
      if (!any) return true;
    }
    for (let other = 0; other < n; other++) {
      if (other === rid || regionDone[other]) continue;
      let any = false;
      for (let rr = 0; rr < n && !any; rr++) for (let cc = 0; cc < n && !any; cc++) any = regions[rr][cc] === other && alive(rr, cc);
      if (!any) return true;
    }
    return false;
  }

  const solved = !contradiction && positions.length === n;
  return {
    solved,
    positions,
    stuckReason: solved
      ? undefined
      : `stuck after placing ${positions.length}/${n} kings by pure deduction -- the rest needs guessing/backtracking`,
    usedLockedCandidates,
    usedLookahead,
    tier: usedLookahead ? 'hard' : usedLockedCandidates ? 'medium' : 'easy',
    rounds,
  };
}
