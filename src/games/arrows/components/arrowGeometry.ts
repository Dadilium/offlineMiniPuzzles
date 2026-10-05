// Pure drawing geometry for the Arrows board, in board points (one cell =
// `cell` pt, origin at the board's top-left). Arrows are lines through cell
// centers with a triangular head; the worklet-tagged helpers also run on the
// UI thread to draw a moving arrow's head every frame.
import { HEAD_TIP, headDirection, toRowCol } from '../engine';
import type { Arrow, Vec } from '../types';

const HEAD_HALF_WIDTH = 0.22;
const HEAD_BACK = 0.04;

/** Hairline-thin, like the reference game: about a tenth of a cell, never under 1pt so it stays visible at 1x on the biggest boards. */
export function strokeWidthFor(cell: number): number {
  return Math.max(1, cell * 0.085);
}

export interface ArrowGeometry {
  /** Body polyline, tail -> head center. */
  bodyD: string;
  headD: string;
  head: { x: number; y: number };
  dir: Vec;
  /** Body polyline length in pt. */
  bodyLength: number;
  /** Cell-center points, tail -> head -- for the hint picker's distance check. */
  points: Array<{ x: number; y: number }>;
}

export function headTriangleD(hx: number, hy: number, dx: number, dy: number, cell: number): string {
  'worklet';
  const tipX = hx + dx * HEAD_TIP * cell;
  const tipY = hy + dy * HEAD_TIP * cell;
  const baseX = hx - dx * HEAD_BACK * cell;
  const baseY = hy - dy * HEAD_BACK * cell;
  // Perpendicular to (dx, dy) is (-dy, dx).
  const wx = -dy * HEAD_HALF_WIDTH * cell;
  const wy = dx * HEAD_HALF_WIDTH * cell;
  return `M${tipX} ${tipY}L${baseX + wx} ${baseY + wy}L${baseX - wx} ${baseY - wy}Z`;
}

export function arrowGeometry(arrow: Arrow, cols: number, cell: number): ArrowGeometry {
  const points = arrow.path.map((index) => {
    const { r, c } = toRowCol(index, cols);
    return { x: (c + 0.5) * cell, y: (r + 0.5) * cell };
  });
  const dir = headDirection(arrow, cols);
  const head = points[points.length - 1];
  return {
    bodyD: points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(''),
    headD: headTriangleD(head.x, head.y, dir.dc, dir.dr, cell),
    head,
    dir,
    bodyLength: (points.length - 1) * cell,
    points,
  };
}

/** Body polyline extended `travel` pt straight past the head -- the track a launched arrow slides along. */
export function launchTrackD(geometry: ArrowGeometry, travel: number): string {
  const { head, dir } = geometry;
  return `${geometry.bodyD}L${head.x + dir.dc * travel} ${head.y + dir.dr * travel}`;
}
