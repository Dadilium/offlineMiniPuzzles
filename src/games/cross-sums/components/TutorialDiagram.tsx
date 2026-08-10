import React from 'react';
import Svg, { Circle, ClipPath, Defs, G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../../theme/ThemeProvider';
import type { Palette } from '../../../theme/palettes';
import type { CellMark } from '../engine';

const BOARD_RADIUS = 10;

// Shared accent palette used both for the tutorial diagrams and the win
// confetti, so the two look like one consistent visual language. Exported as
// a function of `colors` (rather than a static array) since it now depends
// on the active theme -- callers outside this component's render (e.g.
// GameScreen) get their own `colors` from useTheme() and pass it in.
export function getAccentPalette(colors: Palette): string[] {
  return [colors.signalBlue, colors.success, colors.warn, colors.purple, colors.cyan, colors.pink, colors.gold];
}

export interface MiniGridSpec {
  rows: number;
  cols: number;
  grid: number[][];
  marks: CellMark[][];
  rowTargets: number[];
  colTargets: number[];
}

/** Small illustrative rows x cols board used by the Cross Sums tutorial steps -- circled ('selected') cells count toward the sum, crossed-out ('erased') ones don't, blank ('neutral') cells are still undecided. Targets shown along the edges. */
export function CrossSumsMiniGrid({ spec, size }: { spec: MiniGridSpec; size: number }) {
  const { colors } = useTheme();
  const { rows, cols, grid, marks, rowTargets, colTargets } = spec;
  const cw = size / (cols + 1);
  const ch = size / (rows + 1);
  const boardW = cw * cols;
  const boardH = ch * rows;

  const cells: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const selected = marks[r][c] === 'selected';
      const erased = marks[r][c] === 'erased';
      const cx = c * cw + cw / 2;
      const cy = r * ch + ch / 2;
      cells.push(
        <Rect
          key={`bg-${r}-${c}`}
          x={c * cw}
          y={r * ch}
          width={cw}
          height={ch}
          fill={colors.surface2}
          stroke={colors.borderSoft}
          strokeWidth={1}
        />
      );
      if (selected) {
        cells.push(<Circle key={`ring-${r}-${c}`} cx={cx} cy={cy} r={Math.min(cw, ch) * 0.34} fill="none" stroke={colors.success} strokeWidth={1.6} />);
      }
      cells.push(
        <SvgText
          key={`v-${r}-${c}`}
          x={cx}
          y={cy + ch * 0.14}
          fontSize={ch * 0.42}
          textAnchor="middle"
          fill={erased ? colors.textFaint : colors.text}
        >
          {grid[r][c]}
        </SvgText>
      );
      if (erased) {
        cells.push(
          <Line
            key={`x-${r}-${c}`}
            x1={c * cw + cw * 0.24}
            y1={r * ch + ch * 0.24}
            x2={c * cw + cw * 0.76}
            y2={r * ch + ch * 0.76}
            stroke={colors.signalRed}
            strokeWidth={1.4}
          />
        );
      }
    }
  }

  const rowLabels = rowTargets.map((target, r) => (
    <SvgText key={`rt-${r}`} x={boardW + cw / 2} y={r * ch + ch / 2 + ch * 0.14} fontSize={ch * 0.36} textAnchor="middle" fill={colors.textDim}>
      {target}
    </SvgText>
  ));
  const colLabels = colTargets.map((target, c) => (
    <SvgText key={`ct-${c}`} x={c * cw + cw / 2} y={boardH + ch / 2 + ch * 0.14} fontSize={ch * 0.36} textAnchor="middle" fill={colors.textDim}>
      {target}
    </SvgText>
  ));

  return (
    <Svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%">
      <Defs>
        <ClipPath id="boardClip">
          <Rect x={0} y={0} width={boardW} height={boardH} rx={BOARD_RADIUS} />
        </ClipPath>
      </Defs>
      <Rect x={0} y={0} width={boardW} height={boardH} rx={BOARD_RADIUS} fill={colors.surface} stroke={colors.border} />
      <G clipPath="url(#boardClip)">{cells}</G>
      {rowLabels}
      {colLabels}
    </Svg>
  );
}
