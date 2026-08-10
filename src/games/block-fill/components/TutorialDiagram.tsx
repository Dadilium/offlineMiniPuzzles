import React from 'react';
import Svg, { Circle, Polyline, Rect } from 'react-native-svg';
import { useTheme } from '../../../theme/ThemeProvider';

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
  fillColor,
  strokeColor,
}: Props) {
  const { colors } = useTheme();
  // `fillColor`/`strokeColor` default to theme colors, but a hook-sourced
  // value can't be used as a parameter default (evaluated before the
  // component body runs), so the fallback happens here instead.
  const resolvedFillColor = fillColor ?? colors.signalBlue;
  const resolvedStrokeColor = strokeColor ?? colors.signalBlueMuted;
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
          fill={isObstacle ? colors.bgDeep : pathSet.has(key) ? resolvedFillColor : colors.surface2}
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
      {path.length > 1 && <Polyline points={points} fill="none" stroke={resolvedStrokeColor} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />}
      {highlight && (
        <Circle cx={highlight.c * CELL + CELL / 2} cy={highlight.r * CELL + CELL / 2} r={CELL * 0.22} fill="none" stroke={colors.gold} strokeWidth={3} />
      )}
    </Svg>
  );
}
