import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Text, TouchableOpacity, View } from 'react-native';
import { fonts } from '../../../theme/tokens';
import { createThemedStyles } from '../../../theme/createThemedStyles';
import { useTheme } from '../../../theme/ThemeProvider';
import type { CellMark } from '../engine';
import type { CrossSumsLevel } from '../types';

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

/** Diagonal-wave win celebration timing -- see `waveDurationMs`. */
const WAVE_STAGGER_MS = 45;
const WAVE_BOUNCE_MS = 260;

/** Total time for the win-wave bounce to sweep the whole board (last diagonal's delay + its own bounce), so callers know how long to wait before revealing the win overlay. */
export function waveDurationMs(rows: number, cols: number): number {
  return (rows - 1 + cols - 1) * WAVE_STAGGER_MS + WAVE_BOUNCE_MS;
}

interface DigitCellProps {
  value: number;
  mark: CellMark;
  hinted: boolean;
  size: number;
  /** Non-null while the win-wave is playing: this cell's diagonal-group delay in ms. */
  celebrateDelay: number | null;
  onPress: () => void;
}

function DigitCell({ value, mark, hinted, size, celebrateDelay, onPress }: DigitCellProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const selected = mark === 'selected';
  const erased = mark === 'erased';
  const ringScale = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const strikeOpacity = useRef(new Animated.Value(erased ? 1 : 0)).current;
  const prevMark = useRef(mark);
  const bounceScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (mark !== prevMark.current) {
      Animated.spring(ringScale, { toValue: selected ? 1 : 0, friction: 6, tension: 200, useNativeDriver: true }).start();
      Animated.timing(strikeOpacity, { toValue: erased ? 1 : 0, duration: 140, useNativeDriver: true }).start();
      prevMark.current = mark;
    }
  }, [mark, selected, erased, ringScale, strikeOpacity]);

  // Diagonal win-wave: a little bounce that sweeps across the board by
  // (row + col) group, staggered via Animated.delay per cell.
  useEffect(() => {
    if (celebrateDelay === null) return;
    bounceScale.setValue(1);
    Animated.sequence([
      Animated.delay(celebrateDelay),
      Animated.spring(bounceScale, { toValue: 1.22, friction: 4, tension: 220, useNativeDriver: true }),
      Animated.spring(bounceScale, { toValue: 1, friction: 5, tension: 220, useNativeDriver: true }),
    ]).start();
  }, [celebrateDelay, bounceScale]);

  // TouchableOpacity is the root (not a same-level sibling behind the Text)
  // so a tap lands on it no matter which child -- ring, digit, or strike --
  // it hits; RN's touch responder search walks UP the ancestor chain from
  // the touched leaf, not across siblings, so a background Touchable behind
  // a foreground Text never receives taps that land on the text itself.
  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPress={onPress}
      disabled={hinted}
      style={[styles.digitCell, { width: size, height: size }, hinted && styles.digitCellHinted]}
    >
      <Animated.View style={[styles.cellInner, { transform: [{ scale: bounceScale }] }]}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              width: size * 0.68,
              height: size * 0.68,
              borderRadius: (size * 0.68) / 2,
              borderColor: hinted ? colors.gold : colors.success,
              transform: [{ scale: ringScale }],
            },
          ]}
        />
        <Text style={[styles.digitText, { fontSize: size * 0.4, color: erased ? colors.textFaint : colors.text, pointerEvents: 'none' }]}>
          {value}
        </Text>
        <Animated.View pointerEvents="none" style={[styles.strike, { width: size * 0.6, opacity: strikeOpacity }]} />
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
  level: CrossSumsLevel;
  marks: CellMark[][];
  hintedCells: Set<string>;
  rowSums: number[];
  colSums: number[];
  /** True while the win-wave celebration should play (see `waveDurationMs`). */
  celebrate: boolean;
  onCellPress: (r: number, c: number) => void;
}

export default function CrossSumsGrid({ level, marks, hintedCells, rowSums, colSums, celebrate, onCellPress }: Props) {
  const styles = useStyles();
  const { rows, cols, grid } = level;
  const size = cellSizeFor(rows, cols);
  const axisSize = size * 0.82;

  const bodyRows: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    const cellsInRow: React.ReactNode[] = [];
    for (let c = 0; c < cols; c++) {
      const key = `${r},${c}`;
      cellsInRow.push(
        <DigitCell
          key={key}
          value={grid[r][c]}
          mark={marks[r][c]}
          hinted={hintedCells.has(key)}
          size={size}
          celebrateDelay={celebrate ? (r + c) * WAVE_STAGGER_MS : null}
          onPress={() => onCellPress(r, c)}
        />
      );
    }
    cellsInRow.push(<TargetCell key="target" current={rowSums[r]} target={level.rowTargets[r]} size={size} axisSize={axisSize} />);
    bodyRows.push(
      <View key={r} style={styles.row}>
        {cellsInRow}
      </View>
    );
  }

  const footerCells: React.ReactNode[] = [];
  for (let c = 0; c < cols; c++) {
    footerCells.push(<TargetCell key={c} current={colSums[c]} target={level.colTargets[c]} size={axisSize} axisSize={size} />);
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
  digitCell: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  digitCellHinted: { borderColor: colors.gold, borderWidth: 1.5 },
  cellInner: { alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' },
  digitText: { fontFamily: fonts.display, fontWeight: '700' },
  ring: { position: 'absolute', borderWidth: 1.8 },
  strike: {
    position: 'absolute',
    height: 1.6,
    backgroundColor: colors.signalRed,
    transform: [{ rotate: '45deg' }],
  },
  targetCell: { alignItems: 'center', justifyContent: 'center' },
  targetText: { fontFamily: fonts.mono, fontWeight: '600' },
}));
