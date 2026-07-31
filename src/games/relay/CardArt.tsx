import React from 'react';
import Svg, { Circle, Polyline } from 'react-native-svg';

/** Three signal nodes linked by a relay path -- Library grid card motif. */
export default function RelayCardArt({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Polyline points="14,46 32,20 50,46" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" opacity={0.55} />
      <Circle cx={14} cy={46} r={5} fill={color} opacity={0.75} />
      <Circle cx={50} cy={46} r={5} fill={color} opacity={0.75} />
      <Circle cx={32} cy={20} r={7} fill={color} />
    </Svg>
  );
}
