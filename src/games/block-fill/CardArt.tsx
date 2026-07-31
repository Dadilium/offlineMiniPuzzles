import React from 'react';
import Svg, { Rect } from 'react-native-svg';

const CELL = 12;
const ORIGIN = 8;
const FILLED = new Set(['1,1', '2,1', '1,2', '2,2', '3,0']);

/** 4x4 grid with a filled cell cluster -- Library grid card motif for Block Fill. */
export default function BlockFillCardArt({ size, color }: { size: number; color: string }) {
  const cells: React.ReactNode[] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const filled = FILLED.has(`${c},${r}`);
      cells.push(
        <Rect
          key={`${c}-${r}`}
          x={ORIGIN + c * CELL}
          y={ORIGIN + r * CELL}
          width={CELL}
          height={CELL}
          fill={filled ? color : 'transparent'}
          stroke={color}
          strokeWidth={1.5}
          opacity={filled ? 0.85 : 0.25}
        />
      );
    }
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {cells}
    </Svg>
  );
}
