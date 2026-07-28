import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, PanResponder, StyleSheet, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { colors } from '../../../theme/colors';
import type { BlockFillPalette } from '../palette';
import type { Cell } from '../types';

const MIN_CELL = 26;
const MAX_CELL = 52;
// Rough non-board chrome (top bar, status row, legend, controls, safe areas)
// so a tall board sizes itself to actually fit the screen instead of relying
// on the surrounding ScrollView to scroll for it.
const CHROME_ESTIMATE = 340;
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

/** Fits both dimensions on screen at once -- width is the harder constraint on a phone, height matters once boards get tall (see difficulty.ts's ROWS_CEILING). */
function cellSizeFor(rows: number, cols: number): number {
  const widthBudget = Math.floor((screenWidth - 64) / cols);
  const heightBudget = Math.floor((screenHeight - CHROME_ESTIMATE) / rows);
  return Math.max(MIN_CELL, Math.min(MAX_CELL, widthBudget, heightBudget));
}

function cellKey(cell: Cell): string {
  return `${cell.r},${cell.c}`;
}

interface FillCellProps {
  size: number;
  filled: boolean;
  isStart: boolean;
  hinted: boolean;
  fillColor: string;
}

/** Simple scale-in when a cell joins the path -- the "add simple animations" nudge from CLAUDE.md, kept minimal. */
function BlockFillCell({ size, filled, isStart, hinted, fillColor }: FillCellProps) {
  const scale = useRef(new Animated.Value(filled ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue: filled ? 1 : 0, friction: 6, tension: 200, useNativeDriver: true }).start();
  }, [filled, scale]);

  return (
    <View style={[styles.cellOuter, { width: size, height: size }]}>
      <View style={[styles.cellBase, hinted && styles.cellHinted]}>
        <Animated.View pointerEvents="none" style={[styles.fill, { backgroundColor: fillColor, transform: [{ scale }] }]} />
        {isStart && <View style={styles.startDot} />}
      </View>
    </View>
  );
}

interface Props {
  level: { rows: number; cols: number; fillable: boolean[][]; start: Cell };
  path: Cell[];
  palette: BlockFillPalette;
  /** Fired for every cell the finger drags over (or the initial touch) -- the screen decides whether that's a legal extend or a rewind-to-trail-point. */
  onDragToCell: (cell: Cell) => void;
  /** Cell suggested by Hint -- shown as a highlighted ring, not auto-played. */
  hintCell?: Cell | null;
}

export default function BlockFillGrid({ level, path, palette, onDragToCell, hintCell }: Props) {
  const { rows, cols, fillable, start } = level;
  const size = cellSizeFor(rows, cols);
  const W = size * cols;
  const H = size * rows;

  const pathSet = new Set(path.map(cellKey));
  const lastCellRef = useRef<Cell | null>(null);

  function cellAt(locationX: number, locationY: number): Cell | null {
    const c = Math.floor(locationX / size);
    const r = Math.floor(locationY / size);
    if (r < 0 || r >= rows || c < 0 || c >= cols) return null;
    return { r, c };
  }

  /** Orthogonal unit steps from `a` to `b` (exclusive of `a`, inclusive of `b`), row-then-column. Consecutive move samples are rarely truly adjacent -- a mouse drag (simulator/trackpad) or a fast finger swipe both sample far coarser than one cell per event -- so a jump has to be walked cell-by-cell for onDragToCell's adjacency rule to ever see a legal step. Any intermediate step that isn't actually legal (e.g. an obstacle in the way) just no-ops in onDragToCell, same as a stray touch would. */
  function stepsBetween(a: Cell, b: Cell): Cell[] {
    const steps: Cell[] = [];
    let { r, c } = a;
    while (r !== b.r) {
      r += r < b.r ? 1 : -1;
      steps.push({ r, c });
    }
    while (c !== b.c) {
      c += c < b.c ? 1 : -1;
      steps.push({ r, c });
    }
    return steps;
  }

  function handleTouch(locationX: number, locationY: number): void {
    const cell = cellAt(locationX, locationY);
    if (!cell) return;
    const from = lastCellRef.current;
    if (from && from.r === cell.r && from.c === cell.c) return;
    lastCellRef.current = cell;
    if (from) stepsBetween(from, cell).forEach(onDragToCell);
    else onDragToCell(cell);
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Capture-phase claims too -- the board sits inside a ScrollView (for
      // centering; see GameScreen), and without these the ScrollView's own
      // native pan gesture can win the touch before onPanResponderMove ever
      // fires, which reads as "dragging does nothing".
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: (evt) => {
        lastCellRef.current = null;
        handleTouch(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
      },
      onPanResponderMove: (evt) => handleTouch(evt.nativeEvent.locationX, evt.nativeEvent.locationY),
      onPanResponderRelease: () => {
        lastCellRef.current = null;
      },
    })
  ).current;

  const pathPoints = path.map((cell) => `${cell.c * size + size / 2},${cell.r * size + size / 2}`).join(' ');

  const rowViews: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    const cellViews: React.ReactNode[] = [];
    for (let c = 0; c < cols; c++) {
      const key = `${r},${c}`;
      if (!fillable[r][c]) {
        cellViews.push(
          <View key={key} style={[styles.cellOuter, { width: size, height: size }]}>
            <View style={styles.obstacle} />
          </View>
        );
        continue;
      }
      cellViews.push(
        <BlockFillCell
          key={key}
          size={size}
          filled={pathSet.has(key)}
          isStart={r === start.r && c === start.c}
          hinted={!!hintCell && hintCell.r === r && hintCell.c === c}
          fillColor={palette.fill}
        />
      );
    }
    rowViews.push(
      <View key={r} style={styles.row}>
        {cellViews}
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { width: W, height: H }]} {...panResponder.panHandlers}>
      <View>{rowViews}</View>
      {path.length > 1 && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
            <Polyline
              points={pathPoints}
              fill="none"
              stroke={palette.stroke}
              strokeWidth={Math.max(2, size * 0.14)}
              strokeLinecap="round"
              strokeLinejoin="round"
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
    borderRadius: 6,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  fill: { ...StyleSheet.absoluteFillObject, borderRadius: 6 },
  cellHinted: { borderColor: colors.gold, borderWidth: 2 },
  obstacle: { flex: 1, borderRadius: 6, backgroundColor: colors.bgDeep },
  startDot: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: -4,
    marginLeft: -4,
    backgroundColor: colors.text,
  },
});
