import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, TouchableOpacity, View } from 'react-native';
import Svg from 'react-native-svg';
import { createThemedStyles } from '../../../theme/createThemedStyles';
import { useTheme } from '../../../theme/ThemeProvider';
import type { CellState, KingsLevel } from '../types';
import { KingCrownGlyph } from './KingCrown';
import { useRegionPalette } from './TutorialDiagram';

function KingPiece({ size, fill }: { size: number; fill: string }) {
  return (
    <Svg width={size} height={size}>
      <KingCrownGlyph x={size / 2} y={size / 2} size={size} fill={fill} />
    </Svg>
  );
}

const MIN_CELL = 24;
const MAX_CELL = 54;
// Rough non-board chrome (top bar, status row, legend, controls, safe areas)
// so a large board sizes itself to actually fit the screen instead of
// overflowing it -- same estimate as ShikakuGrid, which has the same
// statusRow/legend/controls shape.
const CHROME_ESTIMATE = 330;
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

function cellSizeFor(n: number) {
  const widthBudget = Math.floor((screenWidth - 48) / n);
  const heightBudget = Math.floor((screenHeight - CHROME_ESTIMATE) / n);
  return Math.max(MIN_CELL, Math.min(MAX_CELL, widthBudget, heightBudget));
}

// Dark, fairly opaque lines rather than a bright highlight -- reads clearly
// against any of the (light-to-medium) region colors, so zone boundaries
// stay just as crisp regardless of the board's own fill or the app theme.
const BORDER_STRONG = 'rgba(10,12,18,0.55)';
const BORDER_SOFT = 'rgba(10,12,18,0.22)';
const BOARD_RADIUS = 12;

interface CellProps {
  value: CellState;
  isAuto: boolean;
  isConflict: boolean;
  regionColor: string;
  size: number;
  borderTop: boolean;
  borderLeft: boolean;
  borderRight: boolean;
  borderBottom: boolean;
  isTopLeft: boolean;
  isTopRight: boolean;
  isBottomLeft: boolean;
  isBottomRight: boolean;
  onPress: () => void;
}

function KingsCell({
  value,
  isAuto,
  isConflict,
  regionColor,
  size,
  borderTop,
  borderLeft,
  borderRight,
  borderBottom,
  isTopLeft,
  isTopRight,
  isBottomLeft,
  isBottomRight,
  onPress,
}: CellProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const isKing = value === 2 || value === 3;
  const isHinted = value === 3;
  const kingScale = useRef(new Animated.Value(isKing ? 1 : 0)).current;
  const markOpacity = useRef(new Animated.Value(value === 1 || isAuto ? 1 : 0)).current;
  const conflictPulse = useRef(new Animated.Value(0)).current;
  const prevWasKing = useRef(isKing);
  const prevWasMarked = useRef(value === 1 || isAuto);

  useEffect(() => {
    if (isKing && !prevWasKing.current) {
      kingScale.setValue(0);
      Animated.sequence([
        Animated.spring(kingScale, { toValue: 1.22, friction: 4, tension: 180, useNativeDriver: true }),
        Animated.spring(kingScale, { toValue: 1, friction: 5, tension: 220, useNativeDriver: true }),
      ]).start();
    } else if (isKing) {
      kingScale.setValue(1);
    } else {
      kingScale.setValue(0);
    }
    prevWasKing.current = isKing;
  }, [isKing, kingScale]);

  useEffect(() => {
    const marked = value === 1 || isAuto;
    if (marked && !prevWasMarked.current) {
      markOpacity.setValue(0);
      Animated.timing(markOpacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    } else {
      markOpacity.setValue(marked ? 1 : 0);
    }
    prevWasMarked.current = marked;
  }, [value, isAuto, markOpacity]);

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (isConflict) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(conflictPulse, { toValue: 1, duration: 550, useNativeDriver: true }),
          Animated.timing(conflictPulse, { toValue: 0, duration: 550, useNativeDriver: true }),
        ])
      );
      loop.start();
    } else {
      conflictPulse.setValue(0);
    }
    return () => loop?.stop();
  }, [isConflict, conflictPulse]);

  return (
    <View
      style={[
        styles.cell,
        {
          width: size,
          height: size,
          backgroundColor: regionColor,
          borderTopWidth: borderTop ? 2 : 1,
          borderTopColor: borderTop ? BORDER_STRONG : BORDER_SOFT,
          borderLeftWidth: borderLeft ? 2 : 1,
          borderLeftColor: borderLeft ? BORDER_STRONG : BORDER_SOFT,
          borderRightWidth: borderRight ? 2 : 1,
          borderRightColor: borderRight ? BORDER_STRONG : BORDER_SOFT,
          borderBottomWidth: borderBottom ? 2 : 1,
          borderBottomColor: borderBottom ? BORDER_STRONG : BORDER_SOFT,
          borderTopLeftRadius: isTopLeft ? BOARD_RADIUS : 0,
          borderTopRightRadius: isTopRight ? BOARD_RADIUS : 0,
          borderBottomLeftRadius: isBottomLeft ? BOARD_RADIUS : 0,
          borderBottomRightRadius: isBottomRight ? BOARD_RADIUS : 0,
        },
      ]}
    >
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={0.6} onPress={onPress} />
      {isConflict && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.conflictOverlay,
            { opacity: conflictPulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.9] }) },
          ]}
        />
      )}
      {isKing && (
        <Animated.View pointerEvents="none" style={{ transform: [{ scale: kingScale }] }}>
          <KingPiece size={size * 0.6} fill={isHinted ? colors.gold : '#fffaf0'} />
        </Animated.View>
      )}
      {!isKing && (value === 1 || isAuto) && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.mark,
            {
              width: size * 0.22,
              height: size * 0.22,
              borderRadius: (size * 0.22) / 2,
              opacity: markOpacity,
              backgroundColor: value === 1 ? 'rgba(238,240,246,0.55)' : 'rgba(238,240,246,0.32)',
            },
          ]}
        />
      )}
    </View>
  );
}

interface Props {
  level: KingsLevel;
  board: CellState[][];
  autoUnavailable: Set<string>;
  conflictSet: Set<string>;
  onCellPress: (r: number, c: number) => void;
}

export default function KingsGrid({ level, board, autoUnavailable, conflictSet, onCellPress }: Props) {
  const styles = useStyles();
  const regionPalette = useRegionPalette();
  const n = level.n;
  const size = cellSizeFor(n);
  const W = size * n;
  const H = size * n;

  const rows: React.ReactNode[] = [];
  for (let r = 0; r < n; r++) {
    const cellsInRow: React.ReactNode[] = [];
    for (let c = 0; c < n; c++) {
      const rid = level.regions[r][c];
      // Solid, not blended against the board background -- a fixed alpha
      // would read differently on a near-black board vs. a near-white one,
      // so region colors stay identical across both themes.
      const regionColor = regionPalette[rid % regionPalette.length];
      const key = `${r},${c}`;
      cellsInRow.push(
        <KingsCell
          key={key}
          value={board[r][c]}
          isAuto={autoUnavailable.has(key)}
          isConflict={conflictSet.has(key)}
          regionColor={regionColor}
          size={size}
          borderTop={r === 0 || level.regions[r - 1][c] !== rid}
          borderLeft={c === 0 || level.regions[r][c - 1] !== rid}
          borderRight={c === n - 1 || level.regions[r][c + 1] !== rid}
          borderBottom={r === n - 1 || level.regions[r + 1][c] !== rid}
          isTopLeft={r === 0 && c === 0}
          isTopRight={r === 0 && c === n - 1}
          isBottomLeft={r === n - 1 && c === 0}
          isBottomRight={r === n - 1 && c === n - 1}
          onPress={() => onCellPress(r, c)}
        />
      );
    }
    rows.push(
      <View key={r} style={styles.row}>
        {cellsInRow}
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { width: W, height: H }]}>
      <View style={styles.inner}>{rows}</View>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  wrap: { borderRadius: BOARD_RADIUS, overflow: 'hidden' },
  inner: { borderRadius: BOARD_RADIUS, overflow: 'hidden' },
  row: { flexDirection: 'row' },
  cell: { alignItems: 'center', justifyContent: 'center' },
  mark: {},
  conflictOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderWidth: 2, borderColor: colors.signalRed },
}));
