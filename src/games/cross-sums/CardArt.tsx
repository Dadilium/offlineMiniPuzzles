import React from 'react';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';

/** A kakuro-style split clue cell beside a digit cell -- Library grid card motif for Cross Sums. */
export default function CrossSumsCardArt({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Rect x={8} y={16} width={24} height={24} fill={`${color}1F`} stroke={color} strokeWidth={2} />
      <Line x1={8} y1={16} x2={32} y2={40} stroke={color} strokeWidth={1.5} opacity={0.5} />
      <SvgText x={27} y={24} fontSize={8} fontWeight="700" textAnchor="middle" fill={color}>
        12
      </SvgText>
      <SvgText x={14} y={36} fontSize={8} fontWeight="700" textAnchor="middle" fill={color}>
        4
      </SvgText>
      <Rect x={32} y={16} width={24} height={24} fill="transparent" stroke={color} strokeWidth={2} opacity={0.6} />
      <SvgText x={44} y={32} fontSize={14} fontWeight="700" textAnchor="middle" fill={color}>
        7
      </SvgText>
    </Svg>
  );
}
