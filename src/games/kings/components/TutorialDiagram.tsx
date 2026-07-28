import React from 'react';
import Svg, { Circle, ClipPath, Defs, G, Rect, Text as SvgText } from 'react-native-svg';
import { colors } from '../../../theme/colors';

const BOARD_RADIUS = 10;

// The same 7-color region palette used in the real game grid (see
// KingsGrid.tsx) -- kept here too so tutorial diagrams look identical.
export const REGION_PALETTE = [
  colors.signalBlue,
  colors.signalRed,
  colors.success,
  colors.warn,
  colors.purple,
  colors.cyan,
  colors.pink,
];

export interface MiniCell {
  r: number;
  c: number;
  region: number;
  piece?: 'king' | 'mark';
}

/** Small illustrative n x n region grid used by the Kings tutorial steps. */
export function KingsMiniGrid({ cells, n, size }: { cells: MiniCell[]; n: number; size: number }) {
  const cw = size / n;
  const regionByKey = new Map<string, number>();
  cells.forEach((cell) => regionByKey.set(`${cell.r},${cell.c}`, cell.region));

  const backgrounds: React.ReactNode[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const region = regionByKey.get(`${r},${c}`);
      if (region === undefined) continue;
      backgrounds.push(
        <Rect
          key={`bg-${r}-${c}`}
          x={c * cw}
          y={r * cw}
          width={cw}
          height={cw}
          fill={REGION_PALETTE[region % REGION_PALETTE.length]}
          fillOpacity={0.3}
          stroke={colors.bgDeep}
          strokeWidth={1.5}
        />
      );
    }
  }

  const pieces = cells.map((cell) => {
    const cx = cell.c * cw + cw / 2;
    const cy = cell.r * cw + cw / 2;
    if (cell.piece === 'king') {
      return (
        <SvgText key={`p-${cell.r}-${cell.c}`} x={cx} y={cy + cw * 0.16} fontSize={cw * 0.62} textAnchor="middle" fill="#fffaf0">
          ♚
        </SvgText>
      );
    }
    if (cell.piece === 'mark') {
      return <Circle key={`p-${cell.r}-${cell.c}`} cx={cx} cy={cy} r={cw * 0.09} fill="rgba(238,240,246,0.55)" />;
    }
    return null;
  });

  return (
    <Svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%">
      <Defs>
        <ClipPath id="boardClip">
          <Rect x={0} y={0} width={size} height={size} rx={BOARD_RADIUS} />
        </ClipPath>
      </Defs>
      <Rect x={0} y={0} width={size} height={size} rx={BOARD_RADIUS} fill={colors.surface} stroke={colors.border} />
      <G clipPath="url(#boardClip)">
        {backgrounds}
        {pieces}
      </G>
    </Svg>
  );
}

/** The shared 4x4 layout every tutorial step illustrates against. */
export const TUTORIAL_LAYOUT = [
  [0, 0, 1, 1],
  [0, 0, 1, 1],
  [2, 2, 3, 3],
  [2, 2, 3, 3],
];

export function tutorialCells(pieces: Partial<Record<string, 'king' | 'mark'>> = {}): MiniCell[] {
  const cells: MiniCell[] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      cells.push({ r, c, region: TUTORIAL_LAYOUT[r][c], piece: pieces[`${r},${c}`] });
    }
  }
  return cells;
}
