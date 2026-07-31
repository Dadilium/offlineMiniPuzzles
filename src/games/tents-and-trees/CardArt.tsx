import React from 'react';
import Svg, { Line, Polygon, Rect } from 'react-native-svg';

/** A tree beside its tent on a baseline -- Library grid card motif for Tents & Trees. */
export default function TentsAndTreesCardArt({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Line x1={6} y1={48} x2={58} y2={48} stroke={color} strokeWidth={2} opacity={0.3} />
      <Rect x={18} y={36} width={4} height={12} fill={color} />
      <Polygon points="20,10 6,36 34,36" fill={color} />
      <Polygon points="45,28 30,48 60,48" fill={color} opacity={0.7} />
      <Line x1={45} y1={28} x2={45} y2={48} stroke={color} strokeWidth={1.5} opacity={0.4} />
    </Svg>
  );
}
