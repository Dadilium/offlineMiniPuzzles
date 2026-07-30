import type { Clue } from '../types';

/**
 * Cheap shape signature for a board: dimensions + a rolling hash of the clue
 * list + the full sorted clue list. Clues are sorted by (r, c) first --
 * clue order out of the generator is a recursion artifact of guillotine
 * subdivision, not intrinsic to the board (unlike, say, Tents & Trees' order-
 * free position booleans), so two runs that produce the same board via
 * different recursion paths must still fingerprint identically. Not a
 * canonical form -- just good enough to keep a rolling recent-levels history
 * from serving the same-looking board twice in a row.
 */
export function fingerprintShikaku(rows: number, cols: number, clues: Clue[]): string {
  const sorted = clues.slice().sort((a, b) => a.r - b.r || a.c - b.c);

  let hash = 0;
  for (const clue of sorted) {
    hash = (hash * 31 + clue.r) | 0;
    hash = (hash * 31 + clue.c) | 0;
    hash = (hash * 31 + clue.value) | 0;
  }

  return `${rows}x${cols}:${hash}:${sorted.map((clue) => `${clue.r}.${clue.c}.${clue.value}`).join(',')}`;
}
