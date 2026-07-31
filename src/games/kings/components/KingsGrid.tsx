import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, TouchableOpacity, View } from 'react-native';
import { colors } from '../../../theme/colors';
import type { CellState, KingsLevel } from '../types';
import { REGION_PALETTE } from './TutorialDiagram';

const MAX_CELL = 54;
const screenWidth = Dimensions.get('window').width;

function cellSizeFor(n: number) {
  return Math.min(MAX_CELL, Math.floor((screenWidth - 64) / n));
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const BORDER_STRONG = 'rgba(238,240,246,0.6)';
const BORDER_SOFT = 'rgba(5,6,10,0.28)';
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
        <Animated.Text
          style={[
            styles.king,
            isHinted && styles.kingHinted,
            { fontSize: size * 0.6, transform: [{ scale: kingScale }], pointerEvents: 'none' },
          ]}
        >
          ♚
        </Animated.Text>
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
  const n = level.n;
  const size = cellSizeFor(n);
  const W = size * n;
  const H = size * n;

  const rows: React.ReactNode[] = [];
  for (let r = 0; r < n; r++) {
    const cellsInRow: React.ReactNode[] = [];
    for (let c = 0; c < n; c++) {
      const rid = level.regions[r][c];
      const regionColor = hexToRgba(REGION_PALETTE[rid % REGION_PALETTE.length], 0.3);
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

const styles = StyleSheet.create({
  wrap: { borderRadius: BOARD_RADIUS, overflow: 'hidden' },
  inner: { borderRadius: BOARD_RADIUS, overflow: 'hidden' },
  row: { flexDirection: 'row' },
  cell: { alignItems: 'center', justifyContent: 'center' },
  king: { color: '#fffaf0', fontWeight: '600', textShadowColor: 'rgba(255,176,32,0.65)', textShadowRadius: 6 },
  kingHinted: { color: colors.gold, textShadowColor: 'rgba(255,196,64,0.9)', textShadowRadius: 10 },
  mark: {},
  conflictOverlay: { ...StyleSheet.absoluteFillObject, borderWidth: 2, borderColor: colors.signalRed },
});
