import React from 'react';
import { Circle, G, Rect, Polygon } from 'react-native-svg';

const CROWN_POINTS = '2,16 3,9 5.25,14 7.5,5.5 9.75,14 12,2 14.25,14 16.5,5.5 18.75,14 21,9 22,16';
const CROWN_FINIALS: Array<[number, number, number]> = [
  [3, 9, 1.1],
  [7.5, 5.5, 1.2],
  [12, 2, 1.3],
  [16.5, 5.5, 1.2],
  [21, 9, 1.1],
];
const CROWN_JEWELS: Array<[number, number]> = [
  [7, 17.75],
  [12, 17.75],
  [17, 17.75],
];

interface Props {
  /** Center x/y in the parent <Svg>'s coordinate space. */
  x: number;
  y: number;
  /** Rendered width/height, in the parent's coordinate space. */
  size: number;
  fill: string;
}

/** An ornate 5-point crown (ball finials, jeweled base band) standing in
 * for the ♚ glyph everywhere Kings draws a king piece -- Android's default
 * font has no chess symbols and falls back to an unrelated shape, so this
 * is drawn as SVG to render identically on both platforms. Drawn on a 0-24
 * grid and positioned via transform, so it can be embedded inside any
 * existing <Svg> (the board, tutorial diagrams, etc). */
export function KingCrownGlyph({ x, y, size, fill }: Props) {
  const scale = size / 24;
  return (
    <G transform={`translate(${x - size / 2}, ${y - size / 2}) scale(${scale})`}>
      <Polygon points={CROWN_POINTS} fill={fill} />
      {CROWN_FINIALS.map(([cx, cy, r]) => (
        <Circle key={`${cx},${cy}`} cx={cx} cy={cy} r={r} fill={fill} />
      ))}
      <Rect x={2} y={16} width={20} height={3.5} rx={1.5} fill={fill} />
      {CROWN_JEWELS.map(([cx, cy]) => (
        <Circle key={`${cx},${cy}`} cx={cx} cy={cy} r={1} fill={fill} fillOpacity={0.45} />
      ))}
    </G>
  );
}
