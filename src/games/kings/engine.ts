// Pure game-logic functions for Kings, ported from the verified HTML
// prototype (signal-arcade-prototype.html). No React/RN dependencies in this
// file on purpose -- keeps it trivially unit-testable and reusable by the
// Python-style level generator/solver logic if that ever gets ported too.
import type { CellState, KingPos, KingsLevel, KingsStateResult } from './types';

export function makeEmptyBoard(n: number): CellState[][] {
  return Array.from({ length: n }, () => Array<CellState>(n).fill(0));
}

/** True for both a player-placed king (2) and a hint-revealed king (3). */
export function isKingCell(value: CellState): boolean {
  return value === 2 || value === 3;
}

export function computeKingsState(level: KingsLevel, board: CellState[][]): KingsStateResult {
  const n = level.n;
  const kings: KingPos[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (isKingCell(board[r][c])) kings.push({ r, c, region: level.regions[r][c] });
    }
  }

  const conflictSet = new Set<string>();
  for (let i = 0; i < kings.length; i++) {
    for (let j = i + 1; j < kings.length; j++) {
      const a = kings[i];
      const b = kings[j];
      let conflict = false;
      if (a.r === b.r) conflict = true;
      if (a.c === b.c) conflict = true;
      if (a.region === b.region) conflict = true;
      if (Math.abs(a.r - b.r) <= 1 && Math.abs(a.c - b.c) <= 1) conflict = true;
      if (conflict) {
        conflictSet.add(`${a.r},${a.c}`);
        conflictSet.add(`${b.r},${b.c}`);
      }
    }
  }

  const win = kings.length === n && conflictSet.size === 0;
  return { kings, conflictSet, win };
}

/**
 * Cells that are currently impossible because of an existing king (same row,
 * column, realm, or touching it). This is purely derived from the current
 * kings on every call -- nothing is stored, so removing a king instantly
 * "clears" the auto-marks that only existed because of it.
 */
export function computeAutoUnavailable(level: KingsLevel, board: CellState[][]): Set<string> {
  const n = level.n;
  const auto = new Set<string>();
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!isKingCell(board[r][c])) continue;
      const rid = level.regions[r][c];
      for (let cc = 0; cc < n; cc++) if (cc !== c) auto.add(`${r},${cc}`);
      for (let rr = 0; rr < n; rr++) if (rr !== r) auto.add(`${rr},${c}`);
      for (let rr = 0; rr < n; rr++) {
        for (let cc = 0; cc < n; cc++) {
          if (level.regions[rr][cc] === rid && !(rr === r && cc === c)) auto.add(`${rr},${cc}`);
        }
      }
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const rr = r + dr;
          const cc = c + dc;
          if (rr >= 0 && rr < n && cc >= 0 && cc < n) auto.add(`${rr},${cc}`);
        }
      }
    }
  }
  return auto;
}

/** Cycles a single cell: empty -> mark -> king -> empty. Hinted kings (3) are locked and don't cycle. */
export function cycleCellState(value: CellState): CellState {
  if (value === 3) return value;
  return ((value + 1) % 3) as CellState;
}

/**
 * Reveals one still-missing correct king from the solution as a locked hint
 * cell (state 3). Returns the next board, or null if every solution cell is
 * already correctly filled (no hint left to give).
 */
export function applyHint(level: KingsLevel, board: CellState[][]): CellState[][] | null {
  const target = level.solution.find(([r, c]) => !isKingCell(board[r][c]));
  if (!target) return null;
  const [r, c] = target;
  const next = board.map((row) => row.slice());
  next[r][c] = 3;
  return next;
}
