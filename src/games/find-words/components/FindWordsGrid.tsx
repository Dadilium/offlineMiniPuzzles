import React, { useEffect, useMemo, useRef } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { fonts } from '../../../theme/tokens';
import { createThemedStyles } from '../../../theme/createThemedStyles';
import { useTheme } from '../../../theme/ThemeProvider';
import { lineFromDrag, placementCells } from '../engine';
import { paletteForWord } from '../palette';
import type { Cell, FindWordsLevel, Placement } from '../types';

const MIN_CELL = 20;
const MAX_CELL = 38;
// Rough non-board chrome (top bar, status row, word list below the grid,
// controls, safe areas) so a tall board sizes itself sensibly even before
// the surrounding ScrollView (see GameScreen) takes over for anything
// that still doesn't fit.
const CHROME_ESTIMATE = 420;
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

function cellSizeFor(rows: number, cols: number): number {
  const widthBudget = Math.floor((screenWidth - 40) / cols);
  const heightBudget = Math.floor((screenHeight - CHROME_ESTIMATE) / rows);
  return Math.max(MIN_CELL, Math.min(MAX_CELL, widthBudget, heightBudget));
}

/** Diagonal-wave win celebration stagger -- same shape as Shikaku's grid. How long each bounce takes to settle is derived from the animation's own completion callback (see `onCelebrationSettled` below), not a guessed duration. */
const WAVE_STAGGER_MS = 60;

interface CapsuleGeometry {
  left: number;
  top: number;
  width: number;
  height: number;
  angleDeg: number;
}

/** Positions a pill spanning `cells`' first-to-last centers, extended half a cell past each end so its rounded caps fully cover the end letters -- rotated to match the line's own angle rather than constrained to horizontal/vertical. Marked as a worklet -- pure arithmetic only -- so the live-drag capsule can compute its geometry directly inside `useAnimatedStyle`, on the UI thread. */
function capsuleGeometry(cells: Cell[], size: number): CapsuleGeometry {
  'worklet';
  const first = cells[0];
  const last = cells[cells.length - 1];
  const cx = (cell: Cell) => cell.c * size + size / 2;
  const cy = (cell: Cell) => cell.r * size + size / 2;
  const x1 = cx(first);
  const y1 = cy(first);
  const x2 = cx(last);
  const y2 = cy(last);
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const width = Math.hypot(x2 - x1, y2 - y1) + size;
  const height = size * 0.72;
  const angleDeg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  return { left: midX - width / 2, top: midY - height / 2, width, height, angleDeg };
}

interface FoundCapsuleProps {
  placement: Placement;
  size: number;
  palette: { fill: string; border: string };
  celebrateDelay: number | null;
  /** True for the single capsule with the largest `celebrateDelay` this celebration -- the one whose bounce finishing last means the whole wave is done. */
  isLastToCelebrate: boolean;
  onCelebrationSettled?: () => void;
}

/** One found word's permanent capsule. Pop-in on first mount (a fresh mount = the word was just found), diagonal-wave bounce on win -- same animation shapes as Shikaku's PlacedRectView. */
function FoundCapsule({ placement, size, palette, celebrateDelay, isLastToCelebrate, onCelebrationSettled }: FoundCapsuleProps) {
  const styles = useStyles();
  const popScale = useSharedValue(0);
  const bounceScale = useSharedValue(1);

  useEffect(() => {
    popScale.value = withSpring(1, { duration: 350, dampingRatio: 0.75 });
  }, [popScale]);

  useEffect(() => {
    if (celebrateDelay === null) return;
    bounceScale.value = 1;
    // The win overlay must wait for this animation to actually finish, not a
    // guessed duration -- see ShikakuGrid's identical reasoning.
    bounceScale.value = withDelay(
      celebrateDelay,
      withSequence(
        withSpring(1.14, { duration: 220, dampingRatio: 0.55 }),
        withSpring(1, { duration: 220, dampingRatio: 0.7 }, (finished) => {
          if (finished && isLastToCelebrate && onCelebrationSettled) runOnJS(onCelebrationSettled)();
        })
      )
    );
  }, [celebrateDelay, bounceScale, isLastToCelebrate, onCelebrationSettled]);

  const geo = capsuleGeometry(placementCells(placement), size);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${geo.angleDeg}deg` }, { scale: popScale.value * bounceScale.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.capsule,
        {
          left: geo.left,
          top: geo.top,
          width: geo.width,
          height: geo.height,
          borderRadius: geo.height / 2,
          backgroundColor: palette.fill,
          borderColor: palette.border,
        },
        animatedStyle,
      ]}
    />
  );
}

/**
 * The in-progress drag's line, in a neutral color -- fades out on release if
 * it didn't match anything (a found word gets its own permanent,
 * distinctly-colored FoundCapsule instead, see above).
 *
 * Always mounted (never conditionally rendered on a shared value, which
 * isn't possible from a worklet) -- `hasLine` gates visibility via opacity
 * instead. The geometry itself is computed entirely inside
 * `useAnimatedStyle` from `anchorCell`/`targetCell`, on the UI thread, so
 * the whole live-drag capsule updates with zero bridge crossings.
 */
function SelectionCapsule({
  anchorCell,
  targetCell,
  hasLine,
  rows,
  cols,
  size,
  opacity,
}: {
  anchorCell: SharedValue<Cell | null>;
  targetCell: SharedValue<Cell | null>;
  hasLine: SharedValue<boolean>;
  rows: number;
  cols: number;
  size: number;
  opacity: SharedValue<number>;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const selectionPalette = useMemo(() => ({ border: colors.accentBright, fill: `${colors.accentBright}40` }), [colors]);

  const animatedStyle = useAnimatedStyle(() => {
    const anchor = anchorCell.value;
    const target = targetCell.value;
    if (!anchor || !target) return { opacity: 0 };
    const line = lineFromDrag(anchor, target, rows, cols);
    const geo = capsuleGeometry(line, size);
    return {
      left: geo.left,
      top: geo.top,
      width: geo.width,
      height: geo.height,
      borderRadius: geo.height / 2,
      transform: [{ rotate: `${geo.angleDeg}deg` }],
      opacity: hasLine.value ? opacity.value : 0,
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.capsule,
        {
          backgroundColor: selectionPalette.fill,
          borderColor: selectionPalette.border,
        },
        animatedStyle,
      ]}
    />
  );
}

interface Props {
  level: FindWordsLevel;
  foundIndices: number[];
  /** True while the win-wave celebration should play. */
  celebrate: boolean;
  /** Fired once the diagonal wave has actually finished animating (not a guessed duration) -- the screen should wait for this before showing the win overlay. */
  onCelebrationDone?: () => void;
  /** Called on release with the dragged line's cells (length >= 2). Returns
   * the matched placement index (and updates the caller's state) or null on
   * no match -- the grid uses the return value only to pick pop-in vs
   * reject-fade, all the actual validation lives in the progress hook. */
  onAttemptSelection: (cells: Cell[]) => number | null;
}

export default function FindWordsGrid({ level, foundIndices, celebrate, onCelebrationDone, onAttemptSelection }: Props) {
  const styles = useStyles();
  const { rows, cols, grid, placements } = level;
  const size = cellSizeFor(rows, cols);
  const boardWidth = size * cols;
  const boardHeight = size * rows;

  // Guards `onCelebrationDone` against firing more than once -- multiple
  // capsules can tie for the max stagger delay (same row+col), and each
  // would otherwise independently report "done".
  const celebrationFiredRef = useRef(false);
  useEffect(() => {
    if (!celebrate) celebrationFiredRef.current = false;
  }, [celebrate]);

  function handleCelebrationSettled(): void {
    if (celebrationFiredRef.current) return;
    celebrationFiredRef.current = true;
    onCelebrationDone?.();
  }

  const maxCelebrateDelay = useMemo(() => {
    if (!celebrate || foundIndices.length === 0) return null;
    return Math.max(...foundIndices.map((idx) => (placements[idx].row + placements[idx].col) * WAVE_STAGGER_MS));
  }, [celebrate, foundIndices, placements]);

  // Nothing to animate (shouldn't happen at a real win, since win requires
  // every word found) -- report done immediately rather than never firing.
  useEffect(() => {
    if (celebrate && foundIndices.length === 0) handleCelebrationSettled();
  }, [celebrate, foundIndices.length]);

  // The live drag preview lives entirely on the UI thread (shared values,
  // updated directly from the gesture worklet below) so tracking a finger
  // across the board never round-trips to JS -- unlike Shikaku's rect
  // preview, there's no per-frame validity check needed here at all (the
  // capsule's geometry is pure arithmetic over cell coordinates), so nothing
  // here crosses the bridge until the gesture actually ends.
  const anchorCell = useSharedValue<Cell | null>(null);
  const targetCell = useSharedValue<Cell | null>(null);
  // Gates the capsule's visibility (a shared value can't conditionally
  // mount/unmount a component) -- true whenever anchor/target currently
  // resolve to a line of 2+ cells, so it also correctly hides the capsule
  // again if a drag is pulled back down to a single cell.
  const hasLine = useSharedValue(false);
  const selectionOpacity = useSharedValue(1);

  function cellAtWorklet(x: number, y: number): Cell {
    'worklet';
    const c = Math.min(cols - 1, Math.max(0, Math.floor(x / size)));
    const r = Math.min(rows - 1, Math.max(0, Math.floor(y / size)));
    return { r, c };
  }

  // Only touches shared values -- runs on the JS thread (called via
  // runOnJS below) but doesn't need to be a worklet itself. Keeps
  // anchor/target frozen at their final drag position while the fade plays,
  // so the capsule fades out in place rather than disappearing instantly;
  // only once the fade truly finishes does it clear the line.
  function playRejectFade(): void {
    selectionOpacity.value = 1;
    selectionOpacity.value = withTiming(0, { duration: 150 }, (finished) => {
      if (finished) {
        selectionOpacity.value = 1;
        anchorCell.value = null;
        targetCell.value = null;
        hasLine.value = false;
      }
    });
  }

  // JS-side wrapper -- only JS can call `onAttemptSelection`, so this is
  // what onEnd hands off to via runOnJS once it has a real 2+ cell line.
  function handleAttemptSelection(line: Cell[]): void {
    const matched = onAttemptSelection(line);
    if (matched !== null) {
      anchorCell.value = null;
      targetCell.value = null;
      hasLine.value = false;
    } else {
      playRejectFade();
    }
  }

  // Recreated every render -- a cheap config builder, not a stateful native
  // object -- so its callbacks always close over the current render's
  // `onAttemptSelection` directly; no ref-freshening needed for that
  // (unlike the shared values above, which solve a different, same-gesture-
  // lifecycle timing issue -- staying valid across onUpdate calls that fire
  // faster than a JS re-render could keep up).
  // `minDistance(0)` tracks from the very first pixel of movement, matching
  // the old PanResponder's immediate-grant behavior. The board still sits
  // inside a ScrollView here (see GameScreen) -- gesture-handler's Pan
  // cooperates with a plain RN ScrollView ancestor out of the box, unlike
  // PanResponder, which needed the capture-phase/block-native-responder
  // workaround this used to have.
  const pan = Gesture.Pan()
    .minDistance(0)
    .maxPointers(1)
    .shouldCancelWhenOutside(false)
    .onBegin((e) => {
      const cell = cellAtWorklet(e.x, e.y);
      anchorCell.value = cell;
      targetCell.value = cell;
      hasLine.value = false;
      selectionOpacity.value = 1;
    })
    .onUpdate((e) => {
      const anchor = anchorCell.value;
      if (!anchor) return;
      const target = cellAtWorklet(e.x, e.y);
      targetCell.value = target;
      const line = lineFromDrag(anchor, target, rows, cols);
      hasLine.value = line.length >= 2;
    })
    .onEnd((_e, success) => {
      const anchor = anchorCell.value;
      const target = targetCell.value;
      if (!success || !anchor || !target) {
        anchorCell.value = null;
        targetCell.value = null;
        hasLine.value = false;
        return;
      }
      const line = lineFromDrag(anchor, target, rows, cols);
      if (line.length < 2) {
        anchorCell.value = null;
        targetCell.value = null;
        hasLine.value = false;
        return;
      }
      runOnJS(handleAttemptSelection)(line);
    });

  const gridRows: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    const cellsInRow: React.ReactNode[] = [];
    for (let c = 0; c < cols; c++) {
      cellsInRow.push(
        <View key={c} style={[styles.cell, { width: size, height: size }]}>
          <Text style={[styles.letter, { fontSize: size * 0.52 }]}>{grid[r][c]}</Text>
        </View>
      );
    }
    gridRows.push(
      <View key={r} style={styles.row}>
        {cellsInRow}
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { width: boardWidth, height: boardHeight }]}>
      <View>{gridRows}</View>

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {foundIndices.map((idx) => {
          const celebrateDelay = celebrate ? (placements[idx].row + placements[idx].col) * WAVE_STAGGER_MS : null;
          return (
            <FoundCapsule
              key={idx}
              placement={placements[idx]}
              size={size}
              palette={paletteForWord(idx)}
              celebrateDelay={celebrateDelay}
              isLastToCelebrate={celebrateDelay !== null && celebrateDelay === maxCelebrateDelay}
              onCelebrationSettled={handleCelebrationSettled}
            />
          );
        })}
      </View>

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <SelectionCapsule
          anchorCell={anchorCell}
          targetCell={targetCell}
          hasLine={hasLine}
          rows={rows}
          cols={cols}
          size={size}
          opacity={selectionOpacity}
        />
      </View>

      {/* Childless overlay carries the gesture, on top of and matching the
          grid exactly -- see ShikakuGrid/BlockFillGrid for why. */}
      <GestureDetector gesture={pan}>
        <View style={StyleSheet.absoluteFill} />
      </GestureDetector>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  wrap: { alignSelf: 'center' },
  row: { flexDirection: 'row' },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  letter: {
    fontFamily: fonts.mono,
    fontWeight: '700',
    color: colors.text,
  },
  capsule: {
    position: 'absolute',
    borderWidth: 1.5,
  },
}));
