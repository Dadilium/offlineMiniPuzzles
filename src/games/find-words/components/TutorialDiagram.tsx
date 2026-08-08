import React from 'react';
import Svg, { ClipPath, Defs, G, Rect, Text as SvgText } from 'react-native-svg';
import { colors } from '../../../theme/colors';
import { paletteForWord } from '../palette';
import type { Cell } from '../types';

const BOARD_RADIUS = 10;
const SELECTION_COLOR = { border: colors.accentBright, fill: `${colors.accentBright}40` };

export interface MiniGridHighlight {
  cells: Cell[];
  colorIndex: number;
  /** Renders in the neutral "in-progress drag" color instead of a found-word color. */
  dragging?: boolean;
}

export interface MiniGridSpec {
  /** Square board (rows === cols) so a highlight's diagonal angle stays a true 45deg. */
  size: number;
  grid: string[][];
  highlights: MiniGridHighlight[];
}

/** Small illustrative size x size board used by the Find Words tutorial steps -- same rotated-capsule-over-letters rendering as FindWordsGrid, just in SVG so it composes with the other games' *MiniGrid tutorial diagrams. */
export function FindWordsMiniGrid({ spec, pixelSize }: { spec: MiniGridSpec; pixelSize: number }) {
  const { size, grid, highlights } = spec;
  const cell = pixelSize / size;

  const cells: React.ReactNode[] = [];
  const letters: React.ReactNode[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      cells.push(
        <Rect key={`bg-${r}-${c}`} x={c * cell} y={r * cell} width={cell} height={cell} fill={colors.surface2} stroke={colors.borderSoft} strokeWidth={1} />
      );
      letters.push(
        <SvgText
          key={`l-${r}-${c}`}
          x={c * cell + cell / 2}
          y={r * cell + cell / 2 + cell * 0.16}
          fontSize={cell * 0.42}
          fontWeight="700"
          textAnchor="middle"
          fill={colors.text}
        >
          {grid[r][c]}
        </SvgText>
      );
    }
  }

  const highlightViews = highlights.map((h, i) => {
    const first = h.cells[0];
    const last = h.cells[h.cells.length - 1];
    const cx = (cl: Cell) => cl.c * cell + cell / 2;
    const cy = (cl: Cell) => cl.r * cell + cell / 2;
    const x1 = cx(first);
    const y1 = cy(first);
    const x2 = cx(last);
    const y2 = cy(last);
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const length = Math.hypot(x2 - x1, y2 - y1) + cell;
    const height = cell * 0.72;
    const angleDeg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
    const palette = h.dragging ? SELECTION_COLOR : paletteForWord(h.colorIndex);
    return (
      <Rect
        key={`h-${i}`}
        x={midX - length / 2}
        y={midY - height / 2}
        width={length}
        height={height}
        rx={height / 2}
        fill={palette.fill}
        stroke={palette.border}
        strokeWidth={1.5}
        transform={`rotate(${angleDeg} ${midX} ${midY})`}
      />
    );
  });

  return (
    <Svg viewBox={`0 0 ${pixelSize} ${pixelSize}`} width="100%" height="100%">
      <Defs>
        <ClipPath id="findWordsBoardClip">
          <Rect x={0} y={0} width={pixelSize} height={pixelSize} rx={BOARD_RADIUS} />
        </ClipPath>
      </Defs>
      <Rect x={0} y={0} width={pixelSize} height={pixelSize} rx={BOARD_RADIUS} fill={colors.surface} stroke={colors.border} />
      <G clipPath="url(#findWordsBoardClip)">
        {cells}
        {highlightViews}
        {letters}
      </G>
    </Svg>
  );
}
