import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { fonts } from '../../../theme/tokens';
import { useTheme } from '../../../theme/ThemeProvider';
import { createThemedStyles } from '../../../theme/createThemedStyles';
import { placeRect, rectFromCorners } from '../engine';
import { paletteForClue } from '../palette';
import type { PlacedRect, RectBounds, ShikakuLevel, ShikakuPlayerState } from '../types';

const MIN_CELL = 24;
const MAX_CELL = 52;
// Rough non-board chrome (top bar, status row, legend, controls, safe areas)
// so a tall board sizes itself to actually fit the screen instead of relying
// on the surrounding ScrollView to scroll for it.
const CHROME_ESTIMATE = 330;
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

function cellSizeFor(rows: number, cols: number): number {
  const widthBudget = Math.floor((screenWidth - 48) / cols);
  const heightBudget = Math.floor((screenHeight - CHROME_ESTIMATE) / rows);
  return Math.max(MIN_CELL, Math.min(MAX_CELL, widthBudget, heightBudget));
}

/** Diagonal-wave win celebration stagger -- same shape as Tents & Trees' grid. How long each bounce takes to settle is derived from the animation's own completion callback (see `onCelebrationSettled` below), not a guessed duration. */
const WAVE_STAGGER_MS = 45;

/** Below this raw pixel movement, a release counts as a tap rather than a drawn rectangle. */
function tapThresholdFor(size: number): number {
  return Math.max(10, size * 0.3);
}

/** Shared 4-beat reject shake, used by both a placed rect's conflict flash and the live preview's reject bounce. */
function rejectShakeSequence() {
  'worklet';
  return withSequence(withTiming(6, { duration: 45 }), withTiming(-6, { duration: 45 }), withTiming(4, { duration: 45 }), withTiming(0, { duration: 45 }));
}

interface PlacedRectViewProps {
  rect: PlacedRect;
  size: number;
  hasConflict: boolean;
  hinted: boolean;
  celebrateDelay: number | null;
  /** True for the single rect with the largest `celebrateDelay` this celebration -- the one whose bounce finishing last means the whole wave is done. */
  isLastToCelebrate: boolean;
  onCelebrationSettled?: () => void;
}

/** One committed rectangle. Pop-in on first mount (a fresh mount = "first appearance of a rect for this clueIndex", since a deleted rect really unmounts), rising-edge shake on conflict, diagonal-wave bounce on win -- same animation shapes as Tents & Trees' TentCell. */
function PlacedRectView({ rect, size, hasConflict, hinted, celebrateDelay, isLastToCelebrate, onCelebrationSettled }: PlacedRectViewProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const popScale = useSharedValue(0);
  const shakeX = useSharedValue(0);
  const prevConflict = useRef(hasConflict);
  const bounceScale = useSharedValue(1);

  // Runs once per mount only -- intentionally empty deps, so a
  // resize-in-place (same clueIndex, new bounds, component stays mounted)
  // never re-triggers the pop-in, only a genuine first appearance does.
  useEffect(() => {
    popScale.value = withSpring(1, { duration: 350, dampingRatio: 0.75 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hasConflict && !prevConflict.current && !hinted) {
      shakeX.value = 0;
      shakeX.value = rejectShakeSequence();
    }
    prevConflict.current = hasConflict;
  }, [hasConflict, hinted, shakeX]);

  useEffect(() => {
    if (celebrateDelay === null) return;
    bounceScale.value = 1;
    // The win overlay must wait for this animation to actually finish, not
    // for a guessed duration -- the spring's own completion callback fires
    // only once it's truly settled, so gating on it (for whichever rect is
    // last in the diagonal wave) can't show the overlay early no matter how
    // the spring physics tune out in practice.
    bounceScale.value = withDelay(
      celebrateDelay,
      withSequence(
        withSpring(1.08, { duration: 220, dampingRatio: 0.55 }),
        withSpring(1, { duration: 220, dampingRatio: 0.7 }, (finished) => {
          if (finished && isLastToCelebrate && onCelebrationSettled) runOnJS(onCelebrationSettled)();
        })
      )
    );
  }, [celebrateDelay, bounceScale, isLastToCelebrate, onCelebrationSettled]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: popScale.value,
    transform: [{ scale: popScale.value }, { translateX: shakeX.value }, { scale: bounceScale.value }],
  }));

  const palette = paletteForClue(rect.clueIndex);
  const fill = hasConflict ? `${colors.signalRed}40` : palette.fill;
  const border = hasConflict ? colors.signalRed : hinted ? colors.gold : palette.border;
  const left = rect.c0 * size;
  const top = rect.r0 * size;
  const width = (rect.c1 - rect.c0 + 1) * size;
  const height = (rect.r1 - rect.r0 + 1) * size;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.placedRect,
        {
          left,
          top,
          width,
          height,
          backgroundColor: fill,
          borderColor: border,
          borderWidth: hinted ? 2 : 1.5,
        },
        animatedStyle,
      ]}
    >
      {hinted && <Text style={styles.lockBadge}>{'\u{1F512}'}</Text>}
    </Animated.View>
  );
}

interface Props {
  level: ShikakuLevel;
  placed: ShikakuPlayerState;
  conflicts: Set<number>;
  hintedClueIndices: Set<number>;
  /** True while the win-wave celebration should play. */
  celebrate: boolean;
  /** Fired once the diagonal wave has actually finished animating (not a guessed duration) -- the screen should wait for this before showing the win overlay. */
  onCelebrationDone?: () => void;
  onCommitRect: (candidate: RectBounds) => void;
  onTapCell: (r: number, c: number) => void;
}

export default function ShikakuGrid({
  level,
  placed,
  conflicts,
  hintedClueIndices,
  celebrate,
  onCelebrationDone,
  onCommitRect,
  onTapCell,
}: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { rows, cols, clues } = level;
  const size = cellSizeFor(rows, cols);
  const boardWidth = size * cols;
  const boardHeight = size * rows;

  // Guards `onCelebrationDone` against firing more than once -- multiple
  // rects can tie for the max stagger delay (same r0+c0), and each would
  // otherwise independently report "done".
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
    if (!celebrate || placed.length === 0) return null;
    return Math.max(...placed.map((rect) => (rect.r0 + rect.c0) * WAVE_STAGGER_MS));
  }, [celebrate, placed]);

  // Nothing to animate (shouldn't happen at a real win, since win requires
  // every clue placed) -- report done immediately rather than never firing.
  useEffect(() => {
    if (celebrate && placed.length === 0) handleCelebrationSettled();
  }, [celebrate, placed.length]);

  // The live drag preview lives entirely on the UI thread (shared values,
  // updated directly from the gesture worklet below) so tracking a finger
  // across the board never round-trips to JS -- only `previewCell` (its JS
  // mirror, for the placeRect validity check that decides the preview's
  // color) crosses the bridge, and only when the touch actually crosses into
  // a new cell, not on every raw touch-move frame.
  const anchorCell = useSharedValue<{ r: number; c: number } | null>(null);
  const hasPreview = useSharedValue(false);
  const previewR0 = useSharedValue(0);
  const previewC0 = useSharedValue(0);
  const previewR1 = useSharedValue(0);
  const previewC1 = useSharedValue(0);
  const shakeX = useSharedValue(0);
  const [previewCell, setPreviewCell] = useState<RectBounds | null>(null);

  const previewValid = useMemo(() => {
    if (!previewCell) return true;
    const result = placeRect(level, placed, previewCell);
    return !('error' in result);
  }, [level, placed, previewCell]);

  function cellAtWorklet(x: number, y: number): { r: number; c: number } {
    'worklet';
    const c = Math.min(cols - 1, Math.max(0, Math.floor(x / size)));
    const r = Math.min(rows - 1, Math.max(0, Math.floor(y / size)));
    return { r, c };
  }

  function setPreview(rect: RectBounds): void {
    'worklet';
    hasPreview.value = true;
    previewR0.value = rect.r0;
    previewC0.value = rect.c0;
    previewR1.value = rect.r1;
    previewC1.value = rect.c1;
    runOnJS(setPreviewCell)(rect);
  }

  function clearPreview(): void {
    'worklet';
    hasPreview.value = false;
    runOnJS(setPreviewCell)(null);
  }

  function playRejectShake(): void {
    'worklet';
    shakeX.value = 0;
    shakeX.value = rejectShakeSequence();
    clearPreview();
  }

  // Recreated every render -- a cheap config builder, not a stateful native
  // object -- so its callbacks always close over the current render's
  // `level`/`placed`/`onCommitRect`/`onTapCell` directly; no ref-freshening
  // needed for those (unlike the shared values above, which solve a
  // different, same-gesture-lifecycle timing issue -- staying valid across
  // onUpdate calls that fire faster than a JS re-render could keep up).
  // `minDistance(0)` tracks from the very first pixel of movement, matching
  // the old PanResponder's immediate-grant behavior. Swipe-back is disabled
  // at the navigator level for this screen (see index.tsx), so there's no
  // native edge gesture left to out-prioritize here.
  const pan = Gesture.Pan()
    .minDistance(0)
    .maxPointers(1)
    .shouldCancelWhenOutside(false)
    .onBegin((e) => {
      const cell = cellAtWorklet(e.x, e.y);
      anchorCell.value = cell;
      setPreview(rectFromCorners(cell.r, cell.c, cell.r, cell.c));
    })
    .onUpdate((e) => {
      const anchor = anchorCell.value;
      if (!anchor) return;
      const cell = cellAtWorklet(e.x, e.y);
      const next = rectFromCorners(anchor.r, anchor.c, cell.r, cell.c);
      // Only cross the bridge (for the validity check) when the computed
      // cell bounds actually changed -- a raw touch-move within the same
      // cell is common and shouldn't call into JS at all.
      if (next.r0 === previewR0.value && next.c0 === previewC0.value && next.r1 === previewR1.value && next.c1 === previewC1.value) {
        return;
      }
      setPreview(next);
    })
    .onEnd((e, success) => {
      const anchor = anchorCell.value;
      anchorCell.value = null;
      if (!anchor) return;
      if (!success) {
        clearPreview();
        return;
      }

      const moved = Math.abs(e.translationX) > tapThresholdFor(size) || Math.abs(e.translationY) > tapThresholdFor(size);
      if (!moved) {
        clearPreview();
        runOnJS(onTapCell)(anchor.r, anchor.c);
        return;
      }

      const candidate = hasPreview.value
        ? { r0: previewR0.value, c0: previewC0.value, r1: previewR1.value, c1: previewC1.value }
        : rectFromCorners(anchor.r, anchor.c, anchor.r, anchor.c);
      const result = placeRect(level, placed, candidate);
      if ('error' in result) {
        playRejectShake();
        return;
      }
      clearPreview();
      runOnJS(onCommitRect)(candidate);
    });

  const previewStyle = useAnimatedStyle(() => ({
    left: previewC0.value * size,
    top: previewR0.value * size,
    width: (previewC1.value - previewC0.value + 1) * size,
    height: (previewR1.value - previewR0.value + 1) * size,
    transform: [{ translateX: shakeX.value }],
    opacity: hasPreview.value ? 1 : 0,
  }));

  const gridRows: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    const cellsInRow: React.ReactNode[] = [];
    for (let c = 0; c < cols; c++) {
      cellsInRow.push(<View key={c} style={[styles.cell, { width: size, height: size }]} />);
    }
    gridRows.push(
      <View key={r} style={styles.row}>
        {cellsInRow}
      </View>
    );
  }

  const clueLabels = clues.map((clue, index) => {
    const celebrateDelay = celebrate ? (clue.r + clue.c) * WAVE_STAGGER_MS : null;
    return (
      <ClueLabel
        key={index}
        r={clue.r}
        c={clue.c}
        value={clue.value}
        size={size}
        hinted={hintedClueIndices.has(index)}
        celebrateDelay={celebrateDelay}
      />
    );
  });

  const previewColor = previewValid ? colors.signalBlue : colors.signalRed;

  return (
    <View style={[styles.wrap, { width: boardWidth, height: boardHeight }]}>
      <View>{gridRows}</View>

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {placed.map((rect) => {
          const celebrateDelay = celebrate ? (rect.r0 + rect.c0) * WAVE_STAGGER_MS : null;
          return (
            <PlacedRectView
              key={rect.clueIndex}
              rect={rect}
              size={size}
              hasConflict={conflicts.has(rect.clueIndex)}
              hinted={hintedClueIndices.has(rect.clueIndex)}
              celebrateDelay={celebrateDelay}
              isLastToCelebrate={celebrateDelay !== null && celebrateDelay === maxCelebrateDelay}
              onCelebrationSettled={handleCelebrationSettled}
            />
          );
        })}
      </View>

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {clueLabels}
      </View>

      <Animated.View
        pointerEvents="none"
        style={[styles.previewRect, { backgroundColor: `${previewColor}33`, borderColor: previewColor }, previewStyle]}
      />

      {/* Childless overlay carries the gesture, on top of and matching the
          grid exactly. With nothing nested inside it to be hit-tested
          instead, the event's x/y on every touch is guaranteed relative to
          this view's own bounds on both platforms -- no window/page
          coordinate translation (and its Android-only drift) needed. */}
      <GestureDetector gesture={pan}>
        <View style={StyleSheet.absoluteFill} />
      </GestureDetector>
    </View>
  );
}

function ClueLabel({
  r,
  c,
  value,
  size,
  hinted,
  celebrateDelay,
}: {
  r: number;
  c: number;
  value: number;
  size: number;
  hinted: boolean;
  celebrateDelay: number | null;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const bounceScale = useSharedValue(1);

  useEffect(() => {
    if (celebrateDelay === null) return;
    bounceScale.value = 1;
    bounceScale.value = withDelay(celebrateDelay, withSequence(withSpring(1.25, { duration: 220, dampingRatio: 0.55 }), withSpring(1, { duration: 220, dampingRatio: 0.7 })));
  }, [celebrateDelay, bounceScale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: bounceScale.value }] }));

  return (
    <View style={[styles.clueLabelWrap, { left: c * size, top: r * size, width: size, height: size }]}>
      <Animated.Text style={[styles.clueText, { fontSize: size * 0.42, color: hinted ? colors.gold : colors.text }, animatedStyle]}>
        {value}
      </Animated.Text>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  wrap: { alignSelf: 'center' },
  row: { flexDirection: 'row' },
  cell: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  placedRect: {
    position: 'absolute',
    borderRadius: 4,
  },
  lockBadge: {
    position: 'absolute',
    top: 1,
    left: 2,
    fontSize: 10,
  },
  previewRect: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 4,
  },
  clueLabelWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clueText: {
    fontFamily: fonts.mono,
    fontWeight: '700',
  },
}));
