import type { Placement } from '../types';

/**
 * Cheap shape signature for a board: dimensions + the sorted word list.
 * Word order out of the generator depends on shuffle order, not intrinsic to
 * the board, so two runs landing on the same word set must still
 * fingerprint identically. Not a canonical form -- just good enough to keep
 * a rolling recent-levels history from serving the same word set twice in a
 * row (positions/directions can still differ level to level).
 */
export function fingerprintFindWords(rows: number, cols: number, placements: Placement[]): string {
  const words = placements.map((p) => p.word).sort();
  return `${rows}x${cols}:${words.join(',')}`;
}
