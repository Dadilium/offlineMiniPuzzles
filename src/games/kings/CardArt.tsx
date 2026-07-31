import React from 'react';
import Svg, { G, Line, Polygon } from 'react-native-svg';

const CROWN = '0,14 0,5 4,9 8,1 12,9 16,5 16,14';

/** 3x3 grid with two non-adjacent crowns -- illustrates Kings' no-touch rule. */
export default function KingsCardArt({ size, color }: { size: number; color: string }) {
  const lines = [1, 2].map((i) => (
    <React.Fragment key={i}>
      <Line x1={8 + i * 16} y1={8} x2={8 + i * 16} y2={56} stroke={color} strokeWidth={1.5} opacity={0.25} />
      <Line x1={8} y1={8 + i * 16} x2={56} y2={8 + i * 16} stroke={color} strokeWidth={1.5} opacity={0.25} />
    </React.Fragment>
  ));

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {lines}
      <G transform="translate(12, 12)">
        <Polygon points={CROWN} fill={color} />
      </G>
      <G transform="translate(36, 36)">
        <Polygon points={CROWN} fill={color} opacity={0.7} />
      </G>
    </Svg>
  );
}
