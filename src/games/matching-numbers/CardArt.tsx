import React from 'react';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';

/** Two linked number tiles -- Library grid card motif for Matching Numbers. */
export default function MatchingNumbersCardArt({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Line x1={22} y1={32} x2={42} y2={32} stroke={color} strokeWidth={2.5} strokeDasharray="1,6" strokeLinecap="round" opacity={0.6} />
      <Rect x={6} y={18} width={22} height={28} rx={7} fill={`${color}26`} stroke={color} strokeWidth={2} />
      <SvgText x={17} y={37} fontSize={16} fontWeight="700" textAnchor="middle" fill={color}>
        5
      </SvgText>
      <Rect x={36} y={18} width={22} height={28} rx={7} fill={`${color}26`} stroke={color} strokeWidth={2} />
      <SvgText x={47} y={37} fontSize={16} fontWeight="700" textAnchor="middle" fill={color}>
        5
      </SvgText>
    </Svg>
  );
}
