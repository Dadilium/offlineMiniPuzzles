import React from 'react';
import Svg, { Rect } from 'react-native-svg';
import { colors } from '../../../theme/colors';
import { colorForId } from '../palette';

// Ties the confetti burst's colors to the gameplay palette instead of the
// generic theme accents other games' tutorials use -- a deliberate visual
// callback ("the colors you were just sorting").
export const ACCENT_PALETTE = [0, 1, 5, 8, 10, 6, 3].map(colorForId);

export interface MiniTubesSpec {
  /** Each tube's colors, bottom-to-top. */
  tubes: number[][];
  capacity: number;
  /** Non-null to ring the two tubes involved in the step being illustrated. */
  highlight?: { from: number; to: number } | null;
}

/** Small illustrative row of tubes used by the Color Sort tutorial steps. */
export function ColorSortMiniTubes({ spec, size }: { spec: MiniTubesSpec; size: number }) {
  const { tubes, capacity, highlight } = spec;
  const n = tubes.length;
  const gap = size * 0.05;
  const tubeW = (size - gap * (n - 1)) / n;
  const unitH = (size * 0.82) / capacity;
  const tubeH = unitH * capacity;
  const top = size - tubeH;
  const unitPad = tubeW * 0.1;

  const elements: React.ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const x = i * (tubeW + gap);
    const isHighlighted = !!highlight && (highlight.from === i || highlight.to === i);
    elements.push(
      <Rect
        key={`bg-${i}`}
        x={x}
        y={top}
        width={tubeW}
        height={tubeH}
        rx={tubeW * 0.2}
        fill={colors.surface2}
        stroke={isHighlighted ? colors.gold : colors.border}
        strokeWidth={isHighlighted ? 2.2 : 1.4}
      />
    );

    const tube = tubes[i];
    for (let u = 0; u < tube.length; u++) {
      const y = size - unitH * (u + 1);
      elements.push(
        <Rect
          key={`u-${i}-${u}`}
          x={x + unitPad}
          y={y + unitH * 0.08}
          width={tubeW - unitPad * 2}
          height={unitH * 0.84}
          rx={tubeW * 0.1}
          fill={colorForId(tube[u])}
        />
      );
    }
  }

  return (
    <Svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%">
      {elements}
    </Svg>
  );
}
