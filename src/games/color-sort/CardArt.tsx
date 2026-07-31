import React from 'react';
import Svg, { ClipPath, Defs, G, Line, Path, Rect } from 'react-native-svg';

const TUBE_X = 22;
const TUBE_Y = 10;
const TUBE_W = 20;
const TUBE_H = 44;
// Mirrors the in-game tube's near-square rim and rounded bottom
// (ColorSortBoard's BOTTOM_RADIUS_FACTOR/TOP_RADIUS_FACTOR), so the icon
// reads as the same glass instead of a plain pill.
const TOP_R = 3;
const BOTTOM_R = 9.5;

function tubePath(x: number, y: number, w: number, h: number, topR: number, bottomR: number) {
  return `M${x + topR},${y}
    L${x + w - topR},${y}
    A${topR},${topR} 0 0 1 ${x + w},${y + topR}
    L${x + w},${y + h - bottomR}
    A${bottomR},${bottomR} 0 0 1 ${x + w - bottomR},${y + h}
    L${x + bottomR},${y + h}
    A${bottomR},${bottomR} 0 0 1 ${x},${y + h - bottomR}
    L${x},${y + topR}
    A${topR},${topR} 0 0 1 ${x + topR},${y}
    Z`;
}

/** A tube with 3 stacked color bands -- Library grid card motif for Color Sort. */
export default function ColorSortCardArt({ size, color }: { size: number; color: string }) {
  const outline = tubePath(TUBE_X, TUBE_Y, TUBE_W, TUBE_H, TOP_R, BOTTOM_R);
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Defs>
        <ClipPath id="colorSortTube">
          <Path d={outline} />
        </ClipPath>
      </Defs>
      <G clipPath="url(#colorSortTube)">
        <Rect x={TUBE_X} y={TUBE_Y + TUBE_H - 14} width={TUBE_W} height={14} opacity={0.5} fill={color} />
        <Rect x={TUBE_X} y={TUBE_Y + TUBE_H - 26} width={TUBE_W} height={12} opacity={0.75} fill={color} />
        <Rect x={TUBE_X} y={TUBE_Y + TUBE_H - 36} width={TUBE_W} height={10} fill={color} />
      </G>
      <Path d={outline} fill="none" stroke={color} strokeWidth={2} opacity={0.6} />
      <Line x1={18} y1={TUBE_Y} x2={46} y2={TUBE_Y} stroke={color} strokeWidth={2} strokeLinecap="round" opacity={0.6} />
    </Svg>
  );
}
