import React from 'react';
import Svg, { Circle, Polyline, Rect } from 'react-native-svg';
import { colors } from '../../../theme/colors';

const CELL = 46;

export interface MiniObstacle {
  r: number;
  c: number;
}

interface Props {
  rows: number;
  cols: number;
  obstacles?: MiniObstacle[];
  /** Ordered colored cells -- first is the start. */
  path?: MiniObstacle[];
  /** Extra highlight ring on one cell, e.g. to call out a rewind target. */
  highlight?: MiniObstacle;
  fillColor?: string;
  strokeColor?: string;
}

/** Small illustrative grid used by the Block Fill tutorial steps. */
export function BlockFillMiniGrid({
  rows,
  cols,
  obstacles = [],
  path = [],
  highlight,
  fillColor = colors.signalBlue,
  strokeColor = colors.signalBlueMuted,
}: Props) {
  const width = cols * CELL;
  const height = rows * CELL;
  const obstacleSet = new Set(obstacles.map((o) => `${o.r},${o.c}`));
  const pathSet = new Set(path.map((p) => `${p.r},${p.c}`));

  const cells: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = `${r},${c}`;
      const isObstacle = obstacleSet.has(key);
      cells.push(
        <Rect
          key={`bg-${key}`}
          x={c * CELL}
          y={r * CELL}
          width={CELL}
          height={CELL}
          fill={isObstacle ? colors.bgDeep : pathSet.has(key) ? fillColor : colors.surface2}
          stroke={colors.bgDeep}
          strokeWidth={1.5}
        />
      );
    }
  }

  const points = path.map((p) => `${p.c * CELL + CELL / 2},${p.r * CELL + CELL / 2}`).join(' ');

  return (
    <Svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
      <Rect x={0} y={0} width={width} height={height} rx={10} fill={colors.surface} stroke={colors.border} />
      {cells}
      {path.length > 1 && <Polyline points={points} fill="none" stroke={strokeColor} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />}
      {highlight && (
        <Circle cx={highlight.c * CELL + CELL / 2} cy={highlight.r * CELL + CELL / 2} r={CELL * 0.22} fill="none" stroke={colors.gold} strokeWidth={3} />
      )}
    </Svg>
  );
}
