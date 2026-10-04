import type { ArrowsLevel } from '../types';

/**
 * Cheap shape signature: dimensions + a rolling hash over every arrow's
 * path. Arrow ids are a generation-order artifact, so paths are hashed in a
 * canonical (sorted) order -- the same board built via a different
 * placement order still fingerprints identically.
 */
export function fingerprintArrows(level: Pick<ArrowsLevel, 'rows' | 'cols' | 'arrows'>): string {
  const keys = level.arrows.map((arrow) => arrow.path.join('.')).sort();
  let hash = 0;
  for (const key of keys) {
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
    hash = (hash * 31 + 124) | 0;
  }
  return `${level.rows}x${level.cols}:${level.arrows.length}:${hash >>> 0}`;
}
