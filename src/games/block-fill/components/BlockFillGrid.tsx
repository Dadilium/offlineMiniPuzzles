import React, { useEffect, useRef } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { createThemedStyles } from '../../../theme/createThemedStyles';
import type { BlockFillPalette } from '../palette';
import type { Cell } from '../types';

const MIN_CELL = 26;
const MAX_CELL = 52;
// Rough non-board chrome (top bar, status row, legend, controls, safe areas)
// so a tall board sizes its cells down to actually fit the fixed, non-
// scrolling board area instead of overflowing it.
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

interface TrailSegment {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Straight, square-ended axis-aligned rectangle between each pair of
 * consecutive (and therefore orthogonally adjacent) path cells -- plain
 * Views instead of an SVG Polyline, which has to fully re-parse and redraw
 * its whole `points` string on every single cell added. That's an O(path
 * length) native redraw on every extend, and it's the one thing in this
 * component that scales with how far into a level you are -- fine one cell
 * at a time, but a fast swipe that adds several cells per frame was piling
 * those redraws up. Square ends (not rounded) so two segments sharing a
 * cell-center abut flush instead of each tapering to a rounded tip right at
 * that point -- see the per-cell joint dots rendered alongside these for
 * where the rounding actually comes from. */
function trailSegments(path: Cell[], size: number, thickness: number): TrailSegment[] {
  const segments: TrailSegment[] = [];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const ax = a.c * size + size / 2;
    const ay = a.r * size + size / 2;
    const bx = b.c * size + size / 2;
    const by = b.r * size + size / 2;
    if (a.r === b.r) {
      segments.push({ left: Math.min(ax, bx), top: ay - thickness / 2, width: Math.abs(bx - ax), height: thickness });
    } else {
      segments.push({ left: ax - thickness / 2, top: Math.min(ay, by), width: thickness, height: Math.abs(by - ay) });
    }
  }
  return segments;
}

interface FillCellProps {
  size: number;
  filled: boolean;
  isStart: boolean;
  hinted: boolean;
  fillColor: string;
}

/** Simple scale-in when a cell joins the path -- the "add simple animations"
 * nudge from CLAUDE.md, kept minimal. Memoized because the path prop above
 * changes on every single cell dragged over -- without this, every one of
 * those re-renders every cell in the grid (rows*cols, up to ~80+) instead of
 * just the one or two whose `filled`/`hinted` prop actually flipped, which is
 * what makes a fast drag feel like it's lagging behind the finger. */
const BlockFillCell = React.memo(function BlockFillCell({ size, filled, isStart, hinted, fillColor }: FillCellProps) {
  const styles = useStyles();
  const scale = useSharedValue(filled ? 1 : 0);
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  useEffect(() => {
    scale.value = withSpring(filled ? 1 : 0, { duration: 180, dampingRatio: 0.7 });
  }, [filled, scale]);

  return (
    <View style={[styles.cellOuter, { width: size, height: size }]}>
      <View style={[styles.cellBase, hinted && styles.cellHinted]}>
        <Animated.View pointerEvents="none" style={[styles.fill, { backgroundColor: fillColor }, scaleStyle]} />
        {isStart && <View style={styles.startDot} />}
      </View>
    </View>
  );
});

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
  const styles = useStyles();
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
    if (from) stepsBetween(from, cell).forEach((step) => onDragToCell(step));
    else onDragToCell(cell);
  }

  // Recreated every render (cheap -- this is a config builder, not a
  // stateful native object like PanResponder.create was), so its callbacks
  // always close over the current render's `handleTouch`/`onDragToCell`
  // directly -- no ref-freshening trick needed anymore.
  // `minDistance(0)` matches the old PanResponder's behavior of tracking
  // from the very first pixel of movement instead of RNGH's default ~10px
  // pan-vs-tap disambiguation threshold. Swipe-back is disabled at the
  // navigator level for this screen (see index.tsx), so there's no native
  // edge gesture left to out-prioritize here.
  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .maxPointers(1)
    .shouldCancelWhenOutside(false)
    .onBegin((e) => {
      lastCellRef.current = null;
      handleTouch(e.x, e.y);
    })
    .onUpdate((e) => handleTouch(e.x, e.y))
    .onFinalize(() => {
      lastCellRef.current = null;
    });

  const trailThickness = Math.max(2, size * 0.14);

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
    <View style={[styles.wrap, { width: W, height: H }]}>
      <View>{rowViews}</View>
      {path.length > 1 && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {trailSegments(path, size, trailThickness).map((seg, i) => (
            <View
              key={i}
              style={[styles.trailSegment, { left: seg.left, top: seg.top, width: seg.width, height: seg.height, backgroundColor: palette.stroke }]}
            />
          ))}
          {/* One small round dot per path cell, square-flush segments above.
              Two independently end-capped segments meeting at a shared
              cell-center pinch inward right at that point (both taper to a
              rounded tip at the same spot) -- flat/square segments plus a
              dot on top avoids that: it rounds the true start/end caps and
              fills every turn's corner, with no join left to pinch. */}
          {path.map((cell, i) => (
            <View
              key={`joint-${i}`}
              style={[
                styles.trailJoint,
                {
                  left: cell.c * size + size / 2 - trailThickness / 2,
                  top: cell.r * size + size / 2 - trailThickness / 2,
                  width: trailThickness,
                  height: trailThickness,
                  borderRadius: trailThickness / 2,
                  backgroundColor: palette.stroke,
                },
              ]}
            />
          ))}
        </View>
      )}

      {/* Childless overlay carries the gesture, on top of and matching the
          grid exactly. With nothing nested inside it to be hit-tested
          instead, the event's x/y on every touch is guaranteed relative to
          this view's own bounds -- each cell View underneath no longer
          hijacks the coordinate space. */}
      <GestureDetector gesture={pan}>
        <View style={StyleSheet.absoluteFill} />
      </GestureDetector>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
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
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 6 },
  trailSegment: { position: 'absolute' },
  trailJoint: { position: 'absolute' },
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
}));
