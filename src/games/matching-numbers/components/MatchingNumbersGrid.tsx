import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { colors, fonts } from '../../../theme/colors';
import type { Cell, GridValue } from '../types';

const MAX_CELL = 46;
const screenWidth = Dimensions.get('window').width;

function cellSizeFor(cols: number) {
  return Math.min(MAX_CELL, Math.floor((screenWidth - 64) / cols));
}

function cellKey(cell: Cell): string {
  return `${cell.r},${cell.c}`;
}

const LINE_GROW_MS = 180;
const FADE_MS = 160;
const SHAKE_MS = 400;

const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);

interface CellProps {
  value: number;
  size: number;
  selected: boolean;
  clearing: boolean;
  rejected: boolean;
  onPress: () => void;
}

function MatchingNumbersCell({ value, size, selected, clearing, rejected, onPress }: CellProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const highlight = useRef(new Animated.Value(0)).current;
  const shakeX = useRef(new Animated.Value(0)).current;
  const rejectBlink = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (selected) {
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.15, friction: 4, tension: 200, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 5, tension: 220, useNativeDriver: true }),
      ]).start();
      Animated.timing(highlight, { toValue: 1, duration: 140, useNativeDriver: true }).start();
    } else {
      Animated.timing(highlight, { toValue: 0, duration: 140, useNativeDriver: true }).start();
    }
  }, [selected, scale, highlight]);

  useEffect(() => {
    if (!rejected) {
      shakeX.setValue(0);
      rejectBlink.setValue(0);
      return;
    }
    Animated.sequence([
      Animated.timing(shakeX, { toValue: 1, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.timing(rejectBlink, { toValue: 1, duration: 90, useNativeDriver: true }),
      Animated.timing(rejectBlink, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [rejected, shakeX, rejectBlink]);

  useEffect(() => {
    if (clearing) {
      Animated.parallel([
        Animated.timing(fade, { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.6, duration: FADE_MS, useNativeDriver: true }),
      ]).start();
    } else {
      fade.setValue(1);
      scale.setValue(1);
    }
  }, [clearing, fade, scale]);

  const translateX = shakeX.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] });

  return (
    <Animated.View style={[styles.cellOuter, { width: size, height: size, opacity: fade, transform: [{ scale }, { translateX }] }]}>
      <View style={styles.cellBase}>
        <Animated.View pointerEvents="none" style={[styles.highlight, { opacity: highlight }]} />
        <Animated.View pointerEvents="none" style={[styles.rejectOverlay, { opacity: rejectBlink }]} />
        <Text style={[styles.digit, { fontSize: size * 0.42 }]}>{value}</Text>
      </View>
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={0.7} onPress={onPress} />
    </Animated.View>
  );
}

function pathPixelLength(path: Cell[], size: number): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += Math.hypot((path[i].c - path[i - 1].c) * size, (path[i].r - path[i - 1].r) * size);
  }
  return total;
}

export interface PendingMatch {
  a: Cell;
  b: Cell;
  path: Cell[];
}

interface Props {
  board: GridValue[][];
  /** "r,c" keys currently showing the selection highlight -- covers both the
   * single tap-to-select cell and a Hint's two-cell pulse. */
  highlightedCells: Set<string>;
  pendingMatch: PendingMatch | null;
  rejectedPair: [Cell, Cell] | null;
  onCellPress: (r: number, c: number) => void;
  onMatchAnimationDone: () => void;
  onRejectAnimationDone: () => void;
}

export default function MatchingNumbersGrid({
  board,
  highlightedCells,
  pendingMatch,
  rejectedPair,
  onCellPress,
  onMatchAnimationDone,
  onRejectAnimationDone,
}: Props) {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  const size = cellSizeFor(cols);
  const W = size * cols;
  const H = size * rows;

  const lineProgress = useRef(new Animated.Value(0)).current;
  const prevPendingKey = useRef<string | null>(null);

  useEffect(() => {
    if (!pendingMatch) {
      prevPendingKey.current = null;
      return;
    }
    const k = `${cellKey(pendingMatch.a)}-${cellKey(pendingMatch.b)}`;
    if (prevPendingKey.current === k) return;
    prevPendingKey.current = k;
    lineProgress.setValue(0);
    Animated.sequence([
      Animated.timing(lineProgress, { toValue: 1, duration: LINE_GROW_MS, useNativeDriver: false }),
      Animated.delay(FADE_MS),
    ]).start(() => onMatchAnimationDone());
    // onMatchAnimationDone intentionally excluded -- it closes over state
    // that changes every render; re-running this effect off its identity
    // would restart the animation mid-flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMatch, lineProgress]);

  const rejectTriggeredRef = useRef<string | null>(null);
  useEffect(() => {
    if (!rejectedPair) {
      rejectTriggeredRef.current = null;
      return;
    }
    const k = `${cellKey(rejectedPair[0])}-${cellKey(rejectedPair[1])}`;
    if (rejectTriggeredRef.current === k) return;
    rejectTriggeredRef.current = k;
    const t = setTimeout(() => onRejectAnimationDone(), SHAKE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rejectedPair]);

  const clearingKeys = new Set(pendingMatch ? [cellKey(pendingMatch.a), cellKey(pendingMatch.b)] : []);
  const rejectedKeys = new Set(rejectedPair ? [cellKey(rejectedPair[0]), cellKey(rejectedPair[1])] : []);

  const rowViews: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    const cellViews: React.ReactNode[] = [];
    for (let c = 0; c < cols; c++) {
      const v = board[r][c];
      const k = `${r},${c}`;
      if (v === null) {
        cellViews.push(<View key={k} style={{ width: size, height: size }} />);
        continue;
      }
      cellViews.push(
        <MatchingNumbersCell
          key={k}
          value={v}
          size={size}
          selected={highlightedCells.has(k)}
          clearing={clearingKeys.has(k)}
          rejected={rejectedKeys.has(k)}
          onPress={() => onCellPress(r, c)}
        />
      );
    }
    rowViews.push(
      <View key={r} style={styles.row}>
        {cellViews}
      </View>
    );
  }

  const pathPoints = pendingMatch ? pendingMatch.path.map((cell) => `${cell.c * size + size / 2},${cell.r * size + size / 2}`).join(' ') : '';
  const totalLen = pendingMatch ? pathPixelLength(pendingMatch.path, size) : 0;

  return (
    <View style={[styles.wrap, { width: W, height: H }]}>
      <View>{rowViews}</View>
      {pendingMatch && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
            <AnimatedPolyline
              points={pathPoints}
              fill="none"
              stroke={colors.success}
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={`${totalLen} ${totalLen}`}
              strokeDashoffset={lineProgress.interpolate({ inputRange: [0, 1], outputRange: [totalLen, 0] })}
            />
          </Svg>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center' },
  row: { flexDirection: 'row' },
  cellOuter: { padding: 2 },
  cellBase: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  highlight: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(168,85,247,0.35)', borderRadius: 8 },
  rejectOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,92,92,0.45)', borderRadius: 8 },
  digit: { fontWeight: '700', color: colors.text, fontFamily: fonts.display },
});
