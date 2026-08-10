import React from 'react';
import Svg, { ClipPath, Defs, G, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../../theme/ThemeProvider';
import { paletteForClue } from '../palette';

const BOARD_RADIUS = 10;

export interface MiniGridClue {
  r: number;
  c: number;
  value: number;
}

export interface MiniGridRect {
  r0: number;
  c0: number;
  r1: number;
  c1: number;
  clueIndex: number;
  /** Renders in signalRed instead of the clue's palette color -- illustrates the area-mismatch conflict state. */
  conflict?: boolean;
}

export interface MiniGridSpec {
  rows: number;
  cols: number;
  clues: MiniGridClue[];
  rects: MiniGridRect[];
}

/** Small illustrative rows x cols board used by the Shikaku tutorial steps -- placed rectangles as colored blocks, clue numbers on top so they stay legible through the fill. */
export function ShikakuMiniGrid({ spec, size }: { spec: MiniGridSpec; size: number }) {
  const { colors } = useTheme();
  const { rows, cols, clues, rects } = spec;
  const cw = size / cols;
  const ch = size / rows;

  const cells: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push(<Rect key={`bg-${r}-${c}`} x={c * cw} y={r * ch} width={cw} height={ch} fill={colors.surface2} stroke={colors.borderSoft} strokeWidth={1} />);
    }
  }

  const rectViews = rects.map((rect, i) => {
    const palette = paletteForClue(rect.clueIndex);
    const fill = rect.conflict ? `${colors.signalRed}40` : palette.fill;
    const stroke = rect.conflict ? colors.signalRed : palette.border;
    return (
      <Rect
        key={`rect-${i}`}
        x={rect.c0 * cw}
        y={rect.r0 * ch}
        width={(rect.c1 - rect.c0 + 1) * cw}
        height={(rect.r1 - rect.r0 + 1) * ch}
        fill={fill}
        stroke={stroke}
        strokeWidth={2}
      />
    );
  });

  const clueLabels = clues.map((clue, i) => (
    <SvgText
      key={`clue-${i}`}
      x={clue.c * cw + cw / 2}
      y={clue.r * ch + ch / 2 + ch * 0.16}
      fontSize={ch * 0.42}
      fontWeight="700"
      textAnchor="middle"
      fill={colors.text}
    >
      {clue.value}
    </SvgText>
  ));

  return (
    <Svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%">
      <Defs>
        <ClipPath id="shikakuBoardClip">
          <Rect x={0} y={0} width={size} height={size} rx={BOARD_RADIUS} />
        </ClipPath>
      </Defs>
      <Rect x={0} y={0} width={size} height={size} rx={BOARD_RADIUS} fill={colors.surface} stroke={colors.border} />
      <G clipPath="url(#shikakuBoardClip)">
        {cells}
        {rectViews}
        {clueLabels}
      </G>
    </Svg>
  );
}
