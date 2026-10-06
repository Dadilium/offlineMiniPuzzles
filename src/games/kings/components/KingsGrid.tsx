import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg from 'react-native-svg';
import { createThemedStyles } from '../../../theme/createThemedStyles';
import { useTheme } from '../../../theme/ThemeProvider';
import { playSound } from '../../../sound/soundEngine';
import { markStrokeModeFor, strokeCellValue, type MarkStrokeMode } from '../engine';
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
const MAX_CELL = 60;
// Rough non-board chrome (top bar, status row, legend, controls, safe areas)
// so a large board sizes itself to actually fit the screen instead of
// overflowing it -- same estimate as ShikakuGrid, which has the same
// statusRow/legend/controls shape.
const CHROME_ESTIMATE = 330;
// GameScreenLayout's own board-area side padding (12 each side) -- the board
// fills the rest of the width, so it sits 12pt from each screen edge.
const SIDE_GUTTER_TOTAL = 24;
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

function cellSizeFor(n: number) {
  const widthBudget = Math.floor((screenWidth - SIDE_GUTTER_TOTAL) / n);
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
  const kingScale = useSharedValue(isKing ? 1 : 0);
  const markOpacity = useSharedValue(value === 1 || isAuto ? 1 : 0);
  const conflictPulse = useSharedValue(0);
  const prevWasKing = useRef(isKing);
  const prevWasMarked = useRef(value === 1 || isAuto);

  useEffect(() => {
    if (isKing && !prevWasKing.current) {
      kingScale.value = 0;
      kingScale.value = withSequence(
        withSpring(1.22, { duration: 220, dampingRatio: 0.55 }),
        withSpring(1, { duration: 200, dampingRatio: 0.75 })
      );
    } else if (isKing) {
      kingScale.value = 1;
    } else {
      kingScale.value = 0;
    }
    prevWasKing.current = isKing;
  }, [isKing, kingScale]);

  useEffect(() => {
    const marked = value === 1 || isAuto;
    if (marked && !prevWasMarked.current) {
      markOpacity.value = 0;
      markOpacity.value = withTiming(1, { duration: 160 });
    } else {
      markOpacity.value = marked ? 1 : 0;
    }
    prevWasMarked.current = marked;
  }, [value, isAuto, markOpacity]);

  useEffect(() => {
    if (isConflict) {
      conflictPulse.value = withRepeat(withSequence(withTiming(1, { duration: 550 }), withTiming(0, { duration: 550 })), -1);
    } else {
      conflictPulse.value = 0;
    }
    return () => {
      cancelAnimation(conflictPulse);
    };
  }, [isConflict, conflictPulse]);

  const kingAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: kingScale.value }] }));
  const markAnimatedStyle = useAnimatedStyle(() => ({ opacity: markOpacity.value }));
  const conflictAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(conflictPulse.value, [0, 1], [0.35, 0.9]),
  }));

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
        <Animated.View pointerEvents="none" style={[styles.conflictOverlay, conflictAnimatedStyle]} />
      )}
      {isKing && (
        <Animated.View pointerEvents="none" style={kingAnimatedStyle}>
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
              backgroundColor: value === 1 ? 'rgba(238,240,246,0.55)' : 'rgba(238,240,246,0.32)',
            },
            markAnimatedStyle,
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
  /** A finished drag across cells: paints dots on empty cells, or erases
   * dots when the drag started on one. */
  onMarkStroke: (cells: Array<[number, number]>, mode: MarkStrokeMode) => void;
}

/** Finger travel before a press becomes a mark-painting drag -- below this
 * it stays a plain tap (cycle the cell). */
const DRAG_ACTIVATION_PX = 8;

interface Point {
  x: number;
  y: number;
}

interface ActiveStroke {
  mode: MarkStrokeMode;
  cells: Map<string, [number, number]>;
  last: Point;
}

export default function KingsGrid({ level, board, autoUnavailable, conflictSet, onCellPress, onMarkStroke }: Props) {
  const styles = useStyles();
  const regionPalette = useRegionPalette();
  const n = level.n;
  const size = cellSizeFor(n);
  const W = size * n;
  const H = size * n;

  // Live preview of the stroke in progress; it's committed once, on release,
  // rather than persisting progress on every cell the finger crosses.
  const [preview, setPreview] = useState<{ mode: MarkStrokeMode; keys: Set<string> } | null>(null);
  const strokeRef = useRef<ActiveStroke | null>(null);
  const beginRef = useRef<Point | null>(null);

  function cellAt({ x, y }: Point): [number, number] | null {
    const r = Math.floor(y / size);
    const c = Math.floor(x / size);
    return r >= 0 && r < n && c >= 0 && c < n ? [r, c] : null;
  }

  /** Adds every cell the finger crossed between two samples -- touch events
   * arrive far coarser than one per cell on a fast swipe, so the segment is
   * walked in quarter-cell steps instead of trusting the endpoints. */
  function extendStroke(stroke: ActiveStroke, to: Point): boolean {
    const { last } = stroke;
    const steps = Math.max(1, Math.ceil(Math.hypot(to.x - last.x, to.y - last.y) / (size / 4)));
    let added = false;
    for (let i = 1; i <= steps; i++) {
      const cell = cellAt({ x: last.x + ((to.x - last.x) * i) / steps, y: last.y + ((to.y - last.y) * i) / steps });
      if (!cell) continue;
      const key = `${cell[0]},${cell[1]}`;
      if (stroke.cells.has(key)) continue;
      stroke.cells.set(key, cell);
      added = true;
      const value = board[cell[0]][cell[1]];
      if (strokeCellValue(value, stroke.mode) !== value) {
        void Haptics.selectionAsync();
        playSound('tap');
      }
    }
    stroke.last = to;
    return added;
  }

  function publish(stroke: ActiveStroke): void {
    setPreview({ mode: stroke.mode, keys: new Set(stroke.cells.keys()) });
  }

  // Rebuilt each render (a config builder, same as Block Fill's grid) so the
  // callbacks always see this render's board.
  const paint = Gesture.Pan()
    .runOnJS(true)
    .minDistance(DRAG_ACTIVATION_PX)
    .maxPointers(1)
    .shouldCancelWhenOutside(false)
    .onBegin((e) => {
      beginRef.current = { x: e.x, y: e.y };
    })
    .onStart((e) => {
      const begin = beginRef.current ?? { x: e.x, y: e.y };
      const startCell = cellAt(begin);
      if (!startCell) return;
      const stroke: ActiveStroke = { mode: markStrokeModeFor(board[startCell[0]][startCell[1]]), cells: new Map(), last: begin };
      stroke.cells.set(`${startCell[0]},${startCell[1]}`, startCell);
      const startValue = board[startCell[0]][startCell[1]];
      if (strokeCellValue(startValue, stroke.mode) !== startValue) {
        void Haptics.selectionAsync();
        playSound('tap');
      }
      extendStroke(stroke, { x: e.x, y: e.y });
      strokeRef.current = stroke;
      publish(stroke);
    })
    .onUpdate((e) => {
      const stroke = strokeRef.current;
      if (stroke && extendStroke(stroke, { x: e.x, y: e.y })) publish(stroke);
    })
    .onEnd(() => {
      const stroke = strokeRef.current;
      if (stroke && stroke.cells.size > 0) onMarkStroke([...stroke.cells.values()], stroke.mode);
    })
    .onFinalize(() => {
      strokeRef.current = null;
      beginRef.current = null;
      setPreview(null);
    });

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
      const value = preview?.keys.has(key) ? strokeCellValue(board[r][c], preview.mode) : board[r][c];
      cellsInRow.push(
        <KingsCell
          key={key}
          value={value}
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
    <GestureDetector gesture={paint}>
      <View style={[styles.wrap, { width: W, height: H }]}>
        <View style={styles.inner}>{rows}</View>
      </View>
    </GestureDetector>
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
