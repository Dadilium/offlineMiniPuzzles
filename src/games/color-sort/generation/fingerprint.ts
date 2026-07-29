import type { Tube } from '../types';
import { canonicalKey } from './solver';

/**
 * Cheap shape signature for a board: a rolling hash of the same canonical
 * (order-independent) signature the solver uses for its visited-set --
 * Color Sort boards are genuinely order-independent (unlike a grid puzzle's
 * rows/cols), so sharing one canonicalization keeps this from drifting out
 * of sync with the solver. Not a proof of uniqueness -- just good enough to
 * keep a rolling recent-levels history from serving the same-looking board
 * twice in a row.
 */
export function fingerprintColorSort(tubes: Tube[], capacity: number): string {
  const sig = canonicalKey(tubes);
  let hash = 0;
  for (let i = 0; i < sig.length; i++) hash = (hash * 31 + sig.charCodeAt(i)) | 0;
  return `${tubes.length}x${capacity}:${hash}`;
}
