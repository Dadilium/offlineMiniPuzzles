import React, { useMemo } from 'react';
import Svg, { G, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../../theme/ThemeProvider';
import { toCellIndex } from '../engine';
import { arrowsPalette } from '../palette';
import { arrowGeometry, launchTrackD, strokeWidthFor } from './arrowGeometry';

export interface MiniBoardSpec {
  rows: number;
  cols: number;
  /** Each arrow as [r, c] cells, tail -> head. */
  arrows: Array<Array<[number, number]>>;
  /** Arrow drawn sliding out (dashed trail to the edge). */
  exiting?: number;
  /** Arrow + the one it bumps into, both flashed red. */
  bump?: { arrow: number; blocker: number };
  /** Arrows already cleared -- drawn faint. */
  cleared?: number[];
}

/** Small static board used by the Arrows tutorial steps -- same geometry as the real board, so it reads identically. */
export function ArrowsMiniBoard({ spec, size }: { spec: MiniBoardSpec; size: number }) {
  const { colors, scheme } = useTheme();
  const palette = arrowsPalette(colors, scheme);
  const pad = 10;
  const cell = (size - pad * 2) / Math.max(spec.rows, spec.cols);
  const strokeWidth = strokeWidthFor(cell) * 1.2;

  const geometries = useMemo(
    () =>
      spec.arrows.map((cells, id) =>
        arrowGeometry({ id, path: cells.map(([r, c]) => toCellIndex(r, c, spec.cols)) }, spec.cols, cell)
      ),
    [spec, cell]
  );

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <G x={pad + (size - pad * 2 - cell * spec.cols) / 2} y={pad + (size - pad * 2 - cell * spec.rows) / 2}>
        <Rect x={-cell * 0.3} y={-cell * 0.3} width={cell * (spec.cols + 0.6)} height={cell * (spec.rows + 0.6)} rx={cell * 0.4} fill={palette.plate} />
        {geometries.map((geometry, id) => {
          const isBump = spec.bump && (spec.bump.arrow === id || spec.bump.blocker === id);
          const isExiting = spec.exiting === id;
          const color = isBump ? palette.danger : isExiting ? palette.hint : palette.line;
          const opacity = spec.cleared?.includes(id) ? 0.18 : 1;
          const edgeDistance =
            geometry.dir.dc > 0
              ? spec.cols * cell - geometry.head.x
              : geometry.dir.dc < 0
                ? geometry.head.x
                : geometry.dir.dr > 0
                  ? spec.rows * cell - geometry.head.y
                  : geometry.head.y;
          return (
            <G key={id} opacity={opacity}>
              {isExiting && (
                <Path
                  d={launchTrackD(geometry, edgeDistance + cell * 0.2)}
                  stroke={color}
                  strokeWidth={strokeWidth * 0.6}
                  strokeDasharray={[cell * 0.15, cell * 0.2]}
                  strokeDashoffset={-geometry.bodyLength}
                  fill="none"
                  opacity={0.6}
                />
              )}
              <Path d={geometry.bodyD} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <Path d={geometry.headD} fill={color} />
            </G>
          );
        })}
      </G>
    </Svg>
  );
}
