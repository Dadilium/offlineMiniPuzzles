import React from 'react';
import Svg, { Circle, Line, Rect } from 'react-native-svg';

/** A letter grid with one found word highlighted diagonally, plus a magnifying glass -- Library grid card motif for Find Words. */
export default function FindWordsCardArt({ size, color }: { size: number; color: string }) {
  const gridLines = [16, 24, 32, 40, 48];
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Rect x={8} y={8} width={48} height={48} rx={4} fill="transparent" stroke={color} strokeWidth={2} opacity={0.5} />
      {gridLines.map((pos) => (
        <React.Fragment key={pos}>
          <Line x1={pos} y1={8} x2={pos} y2={56} stroke={color} strokeWidth={1} opacity={0.25} />
          <Line x1={8} y1={pos} x2={56} y2={pos} stroke={color} strokeWidth={1} opacity={0.25} />
        </React.Fragment>
      ))}
      <Rect x={10} y={27} width={44} height={10} rx={5} fill={`${color}33`} stroke={color} strokeWidth={1.5} transform="rotate(-24 32 32)" />
      <Circle cx={45} cy={45} r={7} fill="transparent" stroke={color} strokeWidth={2.5} />
      <Line x1={50} y1={50} x2={57} y2={57} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}
