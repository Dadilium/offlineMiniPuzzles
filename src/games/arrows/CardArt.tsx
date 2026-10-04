import React from 'react';
import Svg, { Path } from 'react-native-svg';

/** Two winding arrows, one sliding out past the edge -- Library grid card motif for Arrows. */
export default function ArrowsCardArt({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Path d="M8 8h48v48H8z" stroke={color} strokeWidth={2} opacity={0.35} strokeLinejoin="round" />
      <Path d="M16 48V32h12V18h10" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M38 12l7 6-7 6z" fill={color} />
      <Path d="M24 50h16V36h8" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" opacity={0.55} />
      <Path d="M48 30l7 6-7 6z" fill={color} opacity={0.55} />
      <Path d="M48 18h8" stroke={color} strokeWidth={2} strokeLinecap="round" strokeDasharray="2 4" opacity={0.7} />
    </Svg>
  );
}
