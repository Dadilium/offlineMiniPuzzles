import React from 'react';
import Svg, { Circle, Rect } from 'react-native-svg';

/** A square subdivided into unequal rectangles -- Library grid card motif for Shikaku. */
export default function ShikakuCardArt({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Rect x={8} y={8} width={48} height={48} rx={4} fill="transparent" stroke={color} strokeWidth={2} opacity={0.5} />
      <Rect x={8} y={8} width={24} height={18} fill={`${color}26`} stroke={color} strokeWidth={1.5} />
      <Rect x={8} y={26} width={24} height={30} fill={`${color}40`} stroke={color} strokeWidth={1.5} />
      <Rect x={32} y={8} width={24} height={30} fill={`${color}33`} stroke={color} strokeWidth={1.5} />
      <Rect x={32} y={38} width={24} height={18} fill={`${color}1F`} stroke={color} strokeWidth={1.5} />
      <Circle cx={20} cy={17} r={2} fill={color} />
      <Circle cx={20} cy={41} r={2} fill={color} />
      <Circle cx={44} cy={23} r={2} fill={color} />
      <Circle cx={44} cy={47} r={2} fill={color} />
    </Svg>
  );
}
