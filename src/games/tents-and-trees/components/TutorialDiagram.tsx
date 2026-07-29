import React from 'react';
import Svg, { ClipPath, Defs, G, Rect, Text as SvgText } from 'react-native-svg';
import { colors } from '../../../theme/colors';

const BOARD_RADIUS = 10;

export interface MiniGridSpec {
  rows: number;
  cols: number;
  trees: boolean[][];
  tents: boolean[][];
  rowTargets: number[];
  colTargets: number[];
}

/** Small illustrative rows x cols board used by the Tents & Trees tutorial steps -- trees and tents shown as glyphs, targets along the edges. */
export function TentsAndTreesMiniGrid({ spec, size }: { spec: MiniGridSpec; size: number }) {
  const { rows, cols, trees, tents, rowTargets, colTargets } = spec;
  const cw = size / (cols + 1);
  const ch = size / (rows + 1);
  const boardW = cw * cols;
  const boardH = ch * rows;

  const cells: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = c * cw + cw / 2;
      const cy = r * ch + ch / 2;
      const isTree = trees[r][c];
      const isTent = tents[r][c];
      cells.push(
        <Rect
          key={`bg-${r}-${c}`}
          x={c * cw}
          y={r * ch}
          width={cw}
          height={ch}
          fill={isTree ? colors.surface3 : colors.surface2}
          stroke={colors.borderSoft}
          strokeWidth={1}
        />
      );
      if (isTree) {
        cells.push(
          <SvgText key={`g-${r}-${c}`} x={cx} y={cy + ch * 0.16} fontSize={ch * 0.44} textAnchor="middle">
            {'\u{1F332}'}
          </SvgText>
        );
      } else if (isTent) {
        cells.push(
          <SvgText key={`g-${r}-${c}`} x={cx} y={cy + ch * 0.16} fontSize={ch * 0.4} textAnchor="middle">
            {'⛺'}
          </SvgText>
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
