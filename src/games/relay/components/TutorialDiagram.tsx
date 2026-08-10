import React from 'react';
import Svg, { Circle, Line, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../../theme/ThemeProvider';
import type { Palette } from '../../../theme/palettes';
import type { SignalColor } from '../types';

// Small SVG diagram building blocks, ported 1:1 from the prototype's
// svgWrap/rangeRing/node/relayNode/receiverRing/connLine/wallBlock helpers.
function strokeColor(c: SignalColor, colors: Palette) {
  return c === 'red' ? colors.signalRed : colors.signalBlue;
}

export function RangeRing({ cx, cy, r, color = 'blue' as SignalColor }: { cx: number; cy: number; r: number; color?: SignalColor }) {
  const { colors } = useTheme();
  return (
    <Circle
      cx={cx}
      cy={cy}
      r={r}
      fill={strokeColor(color, colors)}
      fillOpacity={0.05}
      stroke={strokeColor(color, colors)}
      strokeOpacity={0.4}
      strokeDasharray="4,4"
    />
  );
}

export function SourceNode({ cx, cy, color = 'blue' as SignalColor, label = 'S' }: { cx: number; cy: number; color?: SignalColor; label?: string }) {
  const { colors } = useTheme();
  return (
    <>
      <Circle cx={cx} cy={cy} r={10} fill={strokeColor(color, colors)} stroke="#fff" strokeWidth={1.5} />
      <SvgText x={cx} y={cy + 4} fontSize={10} fontWeight="700" textAnchor="middle" fill="#0a0c10">
        {label}
      </SvgText>
    </>
  );
}

export function RelayDot({ cx, cy, color = 'blue' as SignalColor }: { cx: number; cy: number; color?: SignalColor }) {
  const { colors } = useTheme();
  return <Circle cx={cx} cy={cy} r={7} fill={strokeColor(color, colors)} stroke="#fff" strokeWidth={1.4} />;
}

/** A "beam"-kind relay -- same dot as `RelayDot`, plus the small cross
 * overlay RelayGrid uses on the real board to mark a beam relay. */
export function BeamRelayDot({ cx, cy, color = 'blue' as SignalColor }: { cx: number; cy: number; color?: SignalColor }) {
  const { colors } = useTheme();
  return (
    <>
      <Circle cx={cx} cy={cy} r={7} fill={strokeColor(color, colors)} stroke="#fff" strokeWidth={1.4} />
      <Line x1={cx - 4} y1={cy} x2={cx + 4} y2={cy} stroke="#0a0c10" strokeWidth={1.5} strokeLinecap="round" />
      <Line x1={cx} y1={cy - 4} x2={cx} y2={cy + 4} stroke="#0a0c10" strokeWidth={1.5} strokeLinecap="round" />
    </>
  );
}

export function ReceiverRing({ cx, cy, color = 'blue' as SignalColor }: { cx: number; cy: number; color?: SignalColor }) {
  const { colors } = useTheme();
  return (
    <>
      <Circle cx={cx} cy={cy} r={10} fill="none" stroke={strokeColor(color, colors)} strokeWidth={2.5} />
      <Circle cx={cx} cy={cy} r={3.5} fill={strokeColor(color, colors)} />
    </>
  );
}

export function ConnLine({ x1, y1, x2, y2, color = 'blue' as SignalColor, dashed = false }: { x1: number; y1: number; x2: number; y2: number; color?: SignalColor; dashed?: boolean }) {
  const { colors } = useTheme();
  return (
    <Line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={strokeColor(color, colors)}
      strokeWidth={2.2}
      strokeDasharray={dashed ? '4,3' : undefined}
      strokeOpacity={dashed ? 0.35 : 1}
    />
  );
}

export function WallBlock({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const { colors } = useTheme();
  return <Rect x={x} y={y} width={w} height={h} fill="#04050a" stroke={colors.border} strokeWidth={1} />;
}

/** A mirror tile: "/" bounces N<->E and S<->W, "\" bounces N<->W and S<->E. */
export function MirrorGlyph({ cx, cy, size = 22, orientation = 'back' }: { cx: number; cy: number; size?: number; orientation?: 'fwd' | 'back' }) {
  const { colors } = useTheme();
  const half = size / 2;
  const [x1, y1, x2, y2] =
    orientation === 'fwd' ? [cx - half, cy + half, cx + half, cy - half] : [cx - half, cy - half, cx + half, cy + half];
  return (
    <>
      <Rect x={cx - half - 4} y={cy - half - 4} width={size + 8} height={size + 8} fill={colors.surface3} stroke={colors.border} strokeWidth={1} />
      <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={colors.gold} strokeWidth={3} strokeLinecap="round" />
    </>
  );
}

export function DiagramFrame({ children }: { children: React.ReactNode }) {
  return (
    <Svg viewBox="0 0 270 170" width="100%" height="100%">
      {children}
    </Svg>
  );
}
