/**
 * Cheap shape signature for a region layout: sorted region-size multiset
 * (catches "same size distribution, just relabeled") plus a rolling hash of
 * the raw grid (catches exact/near-exact repeats). Not a canonical form --
 * just good enough to keep a rolling recent-levels history from serving the
 * same-looking board twice in a row.
 */
export function fingerprintRegions(regions: number[][]): string {
  const n = regions.length;
  const sizes = new Array(n).fill(0);
  let hash = 0;
  for (const row of regions) {
    for (const rid of row) {
      sizes[rid]++;
      hash = (hash * 31 + rid + 1) | 0;
    }
  }
  const sizeSignature = sizes.slice().sort((a, b) => a - b).join(',');
  return `${n}:${sizeSignature}:${hash}`;
}
