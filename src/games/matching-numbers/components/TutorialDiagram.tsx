import React from 'react';
import Svg, { ClipPath, Defs, G, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../../theme/ThemeProvider';

const BOARD_RADIUS = 10;
const CELL = 54;

export interface MiniCellSpec {
  r: number;
  c: number;
  value?: number;
  highlighted?: boolean;
}

export interface MiniConnectorSpec {
  path: Array<{ r: number; c: number }>;
  blocked?: boolean;
}

interface Props {
  cells: MiniCellSpec[];
  connector?: MiniConnectorSpec;
  rows?: number;
  cols?: number;
}

/** Small illustrative grid used by the Matching Numbers tutorial steps. */
export function MatchingNumbersMiniGrid({ cells, connector, rows = 3, cols = 4 }: Props) {
  const { colors } = useTheme();
  const width = cols * CELL;
  const height = rows * CELL;
  const cellByKey = new Map<string, MiniCellSpec>();
  cells.forEach((cell) => cellByKey.set(`${cell.r},${cell.c}`, cell));

  const backgrounds: React.ReactNode[] = [];
  const digits: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = cellByKey.get(`${r},${c}`);
      backgrounds.push(
        <Rect
          key={`bg-${r}-${c}`}
          x={c * CELL}
          y={r * CELL}
          width={CELL}
          height={CELL}
          fill={cell?.highlighted ? 'rgba(168,85,247,0.35)' : colors.surface2}
          stroke={colors.bgDeep}
          strokeWidth={1.5}
        />
      );
      if (cell?.value !== undefined) {
        digits.push(
          <SvgText
            key={`d-${r}-${c}`}
            x={c * CELL + CELL / 2}
            y={r * CELL + CELL / 2 + CELL * 0.14}
            fontSize={CELL * 0.42}
            fontWeight="700"
            textAnchor="middle"
            fill={colors.text}
          >
            {cell.value}
          </SvgText>
        );
      }
    }
  }

  const connectorNodes: React.ReactNode[] = [];
  if (connector) {
    const points = connector.path.map((p) => `${p.c * CELL + CELL / 2},${p.r * CELL + CELL / 2}`).join(' ');
    connectorNodes.push(
      <Polyline
        key="connector"
        points={points}
        fill="none"
        stroke={connector.blocked ? colors.signalRed : colors.success}
        strokeWidth={2.5}
        strokeDasharray={connector.blocked ? '5,4' : undefined}
        strokeOpacity={connector.blocked ? 0.6 : 1}
        strokeLinecap="round"
      />
    );
    if (connector.blocked && connector.path.length === 3) {
      const mid = connector.path[1];
      connectorNodes.push(
        <SvgText
          key="blocked-x"
          x={mid.c * CELL + CELL / 2}
          y={mid.r * CELL + CELL / 2 + CELL * 0.12}
          fontSize={CELL * 0.32}
          fontWeight="700"
          textAnchor="middle"
          fill={colors.signalRed}
        >
          ✕
        </SvgText>
      );
    }
  }

  return (
    <Svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
      <Defs>
        <ClipPath id="mnBoardClip">
          <Rect x={0} y={0} width={width} height={height} rx={BOARD_RADIUS} />
        </ClipPath>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} rx={BOARD_RADIUS} fill={colors.surface} stroke={colors.border} />
      <G clipPath="url(#mnBoardClip)">
        {backgrounds}
        {connectorNodes}
        {digits}
      </G>
    </Svg>
  );
}
