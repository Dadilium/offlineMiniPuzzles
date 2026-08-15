import React, { useEffect, useRef } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { fonts } from '../../../theme/tokens';
import { useTheme } from '../../../theme/ThemeProvider';
import { createThemedStyles } from '../../../theme/createThemedStyles';
import { cellsFromGrid, matchedTreeCells, wouldTouchExistingTent } from '../engine';
import type { TentsAndTreesLevel } from '../types';

const MIN_CELL = 34;
const MAX_CELL = 56;
// Rough non-board chrome (top bar, status row, legend, controls, safe areas)
// so a tall board sizes itself to actually fit the screen instead of relying
// on a ScrollView to scroll for it.
const CHROME_ESTIMATE = 320;
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

/** Fits both dimensions on screen at once. +1 row/col accounts for the target-label strip along the right and bottom edges. */
function cellSizeFor(rows: number, cols: number): number {
  const widthBudget = Math.floor((screenWidth - 48) / (cols + 1));
  const heightBudget = Math.floor((screenHeight - CHROME_ESTIMATE) / (rows + 1));
  return Math.max(MIN_CELL, Math.min(MAX_CELL, widthBudget, heightBudget));
}

/** Diagonal-wave win celebration timing -- same shape as Cross Sums' grid. */
const WAVE_STAGGER_MS = 45;
const WAVE_BOUNCE_MS = 260;

export function waveDurationMs(rows: number, cols: number): number {
  return (rows - 1 + cols - 1) * WAVE_STAGGER_MS + WAVE_BOUNCE_MS;
}

interface TreeCellProps {
  size: number;
  celebrateDelay: number | null;
  /** True once this tree has an orthogonally-adjacent tent placed. */
  matched: boolean;
}

function TreeCell({ size, celebrateDelay, matched }: TreeCellProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const bounceScale = useSharedValue(1);
  const matchProgress = useSharedValue(matched ? 1 : 0);
  const prevMatched = useRef(matched);

  useEffect(() => {
    if (celebrateDelay === null) return;
    bounceScale.value = 1;
    bounceScale.value = withDelay(
      celebrateDelay,
      withSequence(withSpring(1.22, { duration: 220, dampingRatio: 0.5 }), withSpring(1, { duration: 220, dampingRatio: 0.65 }))
    );
  }, [celebrateDelay, bounceScale]);

  useEffect(() => {
    if (matched !== prevMatched.current) {
      prevMatched.current = matched;
      matchProgress.value = withTiming(matched ? 1 : 0, { duration: 200 });
    }
  }, [matched, matchProgress]);

  const cellAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(matchProgress.value, [0, 1], [colors.surface3, `${colors.success}26`]),
  }));

  const bounceAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bounceScale.value }],
  }));

  const glyphAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(matchProgress.value, [0, 1], [0.5, 1]),
  }));

  return (
    <Animated.View style={[styles.cell, { width: size, height: size }, cellAnimatedStyle]}>
      <Animated.View style={bounceAnimatedStyle}>
        <Animated.Text style={[styles.glyph, { fontSize: size * 0.5 }, glyphAnimatedStyle]}>🌲</Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}

interface TentCellProps {
  isTent: boolean;
  hasConflict: boolean;
  hinted: boolean;
  size: number;
  celebrateDelay: number | null;
  onPress: () => void;
}

function TentCell({ isTent, hasConflict, hinted, size, celebrateDelay, onPress }: TentCellProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const popScale = useSharedValue(isTent ? 1 : 0);
  const prevIsTent = useRef(isTent);
  const shakeX = useSharedValue(0);
  const prevConflict = useRef(hasConflict);
  const bounceScale = useSharedValue(1);
  const conflictProgress = useSharedValue(hasConflict ? 1 : 0);

  useEffect(() => {
    if (isTent !== prevIsTent.current) {
      popScale.value = withSpring(isTent ? 1 : 0, { duration: 250, dampingRatio: 0.75 });
      prevIsTent.current = isTent;
    }
  }, [isTent, popScale]);

  // A tent that just started touching another tent gets a brief shake to
  // flag the conflict -- the tent stays placed (never auto-blocked) so the
  // player can freely experiment, but the shake plus the persistent red
  // tint below make the problem obvious without needing to check row/col
  // counts to notice it.
  useEffect(() => {
    if (hasConflict && !prevConflict.current) {
      shakeX.value = 0;
      shakeX.value = withSequence(
        withTiming(6, { duration: 45 }),
        withTiming(-6, { duration: 45 }),
        withTiming(4, { duration: 45 }),
        withTiming(0, { duration: 45 })
      );
    }
    prevConflict.current = hasConflict;
    conflictProgress.value = withTiming(hasConflict ? 1 : 0, { duration: 150 });
  }, [hasConflict, shakeX, conflictProgress]);

  useEffect(() => {
    if (celebrateDelay === null) return;
    bounceScale.value = 1;
    bounceScale.value = withDelay(
      celebrateDelay,
      withSequence(withSpring(1.22, { duration: 220, dampingRatio: 0.5 }), withSpring(1, { duration: 220, dampingRatio: 0.65 }))
    );
  }, [celebrateDelay, bounceScale]);

  const conflictBorderAnimatedStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(conflictProgress.value, [0, 1], ['transparent', colors.signalRed]),
    borderWidth: interpolate(conflictProgress.value, [0, 1], [0, 2]),
  }));

  const glyphAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }, { scale: bounceScale.value }],
  }));

  const popAnimatedStyle = useAnimatedStyle(() => ({
    opacity: popScale.value,
    transform: [{ scale: popScale.value }],
  }));

  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPress={onPress}
      disabled={hinted}
      style={[styles.cell, { width: size, height: size }, hinted && styles.cellHinted]}
    >
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, conflictBorderAnimatedStyle]} />
      <Animated.View style={glyphAnimatedStyle}>
        <Animated.Text
          style={[
            styles.glyph,
            {
              fontSize: size * 0.5,
              color: hasConflict ? colors.signalRed : hinted ? colors.gold : colors.text,
            },
            popAnimatedStyle,
          ]}
        >
          ⛺
        </Animated.Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

function TargetCell({ current, target, size, axisSize }: { current: number; target: number; size: number; axisSize: number }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const matched = current === target;
  const over = current > target;
  const color = matched ? colors.success : over ? colors.signalRed : colors.textDim;
  return (
    <View style={[styles.targetCell, { width: axisSize, height: size }]}>
      <Text style={[styles.targetText, { fontSize: size * 0.32, color }]}>{target}</Text>
    </View>
  );
}

interface Props {
  level: TentsAndTreesLevel;
  tents: boolean[][];
  hintedCells: Set<string>;
  rowCounts: number[];
  colCounts: number[];
  /** True while the win-wave celebration should play (see `waveDurationMs`). */
  celebrate: boolean;
  onCellPress: (r: number, c: number) => void;
}

export default function TentsAndTreesGrid({ level, tents, hintedCells, rowCounts, colCounts, celebrate, onCellPress }: Props) {
  const styles = useStyles();
  const { rows, cols, trees } = level;
  const size = cellSizeFor(rows, cols);
  const axisSize = size * 0.82;
  const matchedTrees = matchedTreeCells(cellsFromGrid(trees), cellsFromGrid(tents));

  const bodyRows: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    const cellsInRow: React.ReactNode[] = [];
    for (let c = 0; c < cols; c++) {
      const key = `${r},${c}`;
      const celebrateDelay = celebrate ? (r + c) * WAVE_STAGGER_MS : null;
      if (trees[r][c]) {
        cellsInRow.push(<TreeCell key={key} size={size} celebrateDelay={celebrateDelay} matched={matchedTrees.has(key)} />);
      } else {
        cellsInRow.push(
          <TentCell
            key={key}
            isTent={tents[r][c]}
            hasConflict={tents[r][c] && wouldTouchExistingTent(tents, r, c)}
            hinted={hintedCells.has(key)}
            size={size}
            celebrateDelay={celebrateDelay}
            onPress={() => onCellPress(r, c)}
          />
        );
      }
    }
    cellsInRow.push(<TargetCell key="target" current={rowCounts[r]} target={level.rowTargets[r]} size={size} axisSize={axisSize} />);
    bodyRows.push(
      <View key={r} style={styles.row}>
        {cellsInRow}
      </View>
    );
  }

  const footerCells: React.ReactNode[] = [];
  for (let c = 0; c < cols; c++) {
    footerCells.push(<TargetCell key={c} current={colCounts[c]} target={level.colTargets[c]} size={axisSize} axisSize={size} />);
  }
  footerCells.push(<View key="corner" style={{ width: axisSize, height: axisSize }} />);

  return (
    <View style={styles.wrap}>
      {bodyRows}
      <View style={styles.row}>{footerCells}</View>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  wrap: { alignItems: 'center' },
  row: { flexDirection: 'row' },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  cellHinted: { borderColor: colors.gold, borderWidth: 1.5 },
  glyph: { textAlign: 'center' },
  targetCell: { alignItems: 'center', justifyContent: 'center' },
  targetText: { fontFamily: fonts.mono, fontWeight: '600' },
}));
