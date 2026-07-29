import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts } from '../../../theme/colors';
import { wouldTouchExistingTent } from '../engine';
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

function TreeCell({ size, celebrateDelay }: { size: number; celebrateDelay: number | null }) {
  const bounceScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (celebrateDelay === null) return;
    bounceScale.setValue(1);
    Animated.sequence([
      Animated.delay(celebrateDelay),
      Animated.spring(bounceScale, { toValue: 1.22, friction: 4, tension: 220, useNativeDriver: true }),
      Animated.spring(bounceScale, { toValue: 1, friction: 5, tension: 220, useNativeDriver: true }),
    ]).start();
  }, [celebrateDelay, bounceScale]);

  return (
    <View style={[styles.cell, styles.treeCell, { width: size, height: size }]}>
      <Animated.Text style={[styles.glyph, { fontSize: size * 0.5, transform: [{ scale: bounceScale }] }]}>🌲</Animated.Text>
    </View>
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
  const popScale = useRef(new Animated.Value(isTent ? 1 : 0)).current;
  const prevIsTent = useRef(isTent);
  const shakeX = useRef(new Animated.Value(0)).current;
  const prevConflict = useRef(hasConflict);
  const bounceScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isTent !== prevIsTent.current) {
      Animated.spring(popScale, { toValue: isTent ? 1 : 0, friction: 6, tension: 220, useNativeDriver: true }).start();
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
      shakeX.setValue(0);
      Animated.sequence([
        Animated.timing(shakeX, { toValue: 6, duration: 45, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: -6, duration: 45, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 4, duration: 45, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 0, duration: 45, useNativeDriver: true }),
      ]).start();
    }
    prevConflict.current = hasConflict;
  }, [hasConflict, shakeX]);

  useEffect(() => {
    if (celebrateDelay === null) return;
    bounceScale.setValue(1);
    Animated.sequence([
      Animated.delay(celebrateDelay),
      Animated.spring(bounceScale, { toValue: 1.22, friction: 4, tension: 220, useNativeDriver: true }),
      Animated.spring(bounceScale, { toValue: 1, friction: 5, tension: 220, useNativeDriver: true }),
    ]).start();
  }, [celebrateDelay, bounceScale]);

  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPress={onPress}
      disabled={hinted}
      style={[styles.cell, { width: size, height: size }, hinted && styles.cellHinted]}
    >
      <Animated.View style={{ transform: [{ translateX: shakeX }, { scale: bounceScale }] }}>
        <Animated.Text
          style={[
            styles.glyph,
            {
              fontSize: size * 0.5,
              opacity: popScale,
              transform: [{ scale: popScale }],
              color: hasConflict ? colors.signalRed : hinted ? colors.gold : colors.text,
            },
          ]}
        >
          ⛺
        </Animated.Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

function TargetCell({ current, target, size, axisSize }: { current: number; target: number; size: number; axisSize: number }) {
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
  const { rows, cols, trees } = level;
  const size = cellSizeFor(rows, cols);
  const axisSize = size * 0.82;

  const bodyRows: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    const cellsInRow: React.ReactNode[] = [];
    for (let c = 0; c < cols; c++) {
      const key = `${r},${c}`;
      const celebrateDelay = celebrate ? (r + c) * WAVE_STAGGER_MS : null;
      if (trees[r][c]) {
        cellsInRow.push(<TreeCell key={key} size={size} celebrateDelay={celebrateDelay} />);
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

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  row: { flexDirection: 'row' },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  treeCell: { backgroundColor: colors.surface3 },
  cellHinted: { borderColor: colors.gold, borderWidth: 1.5 },
  glyph: { textAlign: 'center' },
  targetCell: { alignItems: 'center', justifyContent: 'center' },
  targetText: { fontFamily: fonts.mono, fontWeight: '600' },
});
