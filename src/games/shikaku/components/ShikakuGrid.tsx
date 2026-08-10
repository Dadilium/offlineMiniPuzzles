import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, PanResponder, StyleSheet, Text, View } from 'react-native';
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
  const popScale = useRef(new Animated.Value(0)).current;
  const shakeX = useRef(new Animated.Value(0)).current;
  const prevConflict = useRef(hasConflict);
  const bounceScale = useRef(new Animated.Value(1)).current;

  // Runs once per mount only -- intentionally empty deps, so a
  // resize-in-place (same clueIndex, new bounds, component stays mounted)
  // never re-triggers the pop-in, only a genuine first appearance does.
  useEffect(() => {
    Animated.spring(popScale, { toValue: 1, friction: 6, tension: 210, useNativeDriver: true }).start();
  }, [popScale]);

  useEffect(() => {
    if (hasConflict && !prevConflict.current && !hinted) {
      shakeX.setValue(0);
      Animated.sequence([
        Animated.timing(shakeX, { toValue: 6, duration: 45, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: -6, duration: 45, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 4, duration: 45, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 0, duration: 45, useNativeDriver: true }),
      ]).start();
    }
    prevConflict.current = hasConflict;
  }, [hasConflict, hinted, shakeX]);

  useEffect(() => {
    if (celebrateDelay === null) return;
    bounceScale.setValue(1);
    // The win overlay must wait for this animation to actually finish, not
    // for a guessed duration -- `.start`'s callback fires only once the
    // native driver reports the sequence truly settled, so gating on it
    // (for whichever rect is last in the diagonal wave) can't show the
    // overlay early no matter how the spring physics tune out in practice.
    Animated.sequence([
      Animated.delay(celebrateDelay),
      Animated.spring(bounceScale, { toValue: 1.08, friction: 4, tension: 220, useNativeDriver: true }),
      Animated.spring(bounceScale, { toValue: 1, friction: 5, tension: 220, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished && isLastToCelebrate) onCelebrationSettled?.();
    });
  }, [celebrateDelay, bounceScale, isLastToCelebrate, onCelebrationSettled]);

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
          opacity: popScale,
          transform: [{ scale: popScale }, { translateX: shakeX }, { scale: bounceScale }],
        },
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

  const anchorRef = useRef<{ r: number; c: number } | null>(null);
  const [previewRect, setPreviewRect] = useState<RectBounds | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const shakeX = useRef(new Animated.Value(0)).current;

  // PanResponder.create runs once, inside the useRef initializer below, so
  // its handlers close over whatever `placed`/`previewRect` looked like on
  // that first render -- `placed` changes on every commit, so the handlers
  // must read it through a ref that's kept fresh every render (same trick
  // useShikakuProgress uses for `stateRef`), not through the closed-over
  // variable directly. `level` doesn't actually change within one mounted
  // level, but it's mirrored too for safety/symmetry.
  const levelRef = useRef(level);
  levelRef.current = level;
  const placedRef = useRef(placed);
  placedRef.current = placed;
  const previewRectRef = useRef<RectBounds | null>(null);
  const onCommitRectRef = useRef(onCommitRect);
  onCommitRectRef.current = onCommitRect;
  const onTapCellRef = useRef(onTapCell);
  onTapCellRef.current = onTapCell;

  function updatePreview(rect: RectBounds | null): void {
    previewRectRef.current = rect;
    setPreviewRect(rect);
  }

  const previewValid = useMemo(() => {
    if (!previewRect) return true;
    const result = placeRect(level, placed, previewRect);
    return !('error' in result);
  }, [level, placed, previewRect]);

  function cellAt(x: number, y: number): { r: number; c: number } {
    const c = Math.min(cols - 1, Math.max(0, Math.floor(x / size)));
    const r = Math.min(rows - 1, Math.max(0, Math.floor(y / size)));
    return { r, c };
  }

  function playRejectShake(): void {
    setRejecting(true);
    shakeX.setValue(0);
    Animated.sequence([
      Animated.timing(shakeX, { toValue: 6, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -6, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 4, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0, duration: 45, useNativeDriver: true }),
    ]).start(() => {
      setRejecting(false);
      updatePreview(null);
    });
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Capture-phase claims too, so an ancestor (e.g. the stack navigator's
      // edge-swipe-back gesture) can't win the touch before
      // onPanResponderMove ever fires -- that would read as "dragging does
      // nothing".
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      // Once granted, never yield to an ancestor mid-gesture -- without
      // this, dragging past the board's edge (where an ancestor is more
      // likely to contest the touch) can hand the gesture off natively and
      // the drag stops tracking or the preview resets, which reads as "the
      // selection changes on its own". `onShouldBlockNativeResponder` is
      // Android-only; iOS ignores it.
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const cell = cellAt(locationX, locationY);
        anchorRef.current = cell;
        updatePreview(rectFromCorners(cell.r, cell.c, cell.r, cell.c));
      },
      onPanResponderMove: (evt) => {
        const anchor = anchorRef.current;
        if (!anchor) return;
        const { locationX, locationY } = evt.nativeEvent;
        const cell = cellAt(locationX, locationY);
        updatePreview(rectFromCorners(anchor.r, anchor.c, cell.r, cell.c));
      },
      onPanResponderRelease: (_evt, gestureState) => {
        const anchor = anchorRef.current;
        anchorRef.current = null;
        if (!anchor) return;

        const moved = Math.abs(gestureState.dx) > tapThresholdFor(size) || Math.abs(gestureState.dy) > tapThresholdFor(size);
        if (!moved) {
          updatePreview(null);
          onTapCellRef.current(anchor.r, anchor.c);
          return;
        }

        const candidate = previewRectRef.current ?? rectFromCorners(anchor.r, anchor.c, anchor.r, anchor.c);
        const result = placeRect(levelRef.current, placedRef.current, candidate);
        if ('error' in result) {
          playRejectShake();
          return;
        }
        updatePreview(null);
        onCommitRectRef.current(candidate);
      },
      onPanResponderTerminate: () => {
        anchorRef.current = null;
        updatePreview(null);
      },
    })
  ).current;

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

  const previewLeft = previewRect ? previewRect.c0 * size : 0;
  const previewTop = previewRect ? previewRect.r0 * size : 0;
  const previewWidth = previewRect ? (previewRect.c1 - previewRect.c0 + 1) * size : 0;
  const previewHeight = previewRect ? (previewRect.r1 - previewRect.r0 + 1) * size : 0;
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

      {previewRect && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.previewRect,
            {
              left: previewLeft,
              top: previewTop,
              width: previewWidth,
              height: previewHeight,
              backgroundColor: `${previewColor}33`,
              borderColor: previewColor,
              transform: [{ translateX: rejecting ? shakeX : 0 }],
            },
          ]}
        />
      )}

      {/* Childless overlay carries the PanResponder, on top of and matching
          the grid exactly. With nothing nested inside it to be hit-tested
          instead, `locationX/Y` on every touch is guaranteed relative to
          this view's own bounds on both platforms -- no window/page
          coordinate translation (and its Android-only drift) needed. */}
      <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers} />
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
  const bounceScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (celebrateDelay === null) return;
    bounceScale.setValue(1);
    Animated.sequence([
      Animated.delay(celebrateDelay),
      Animated.spring(bounceScale, { toValue: 1.25, friction: 4, tension: 220, useNativeDriver: true }),
      Animated.spring(bounceScale, { toValue: 1, friction: 5, tension: 220, useNativeDriver: true }),
    ]).start();
  }, [celebrateDelay, bounceScale]);

  return (
    <View style={[styles.clueLabelWrap, { left: c * size, top: r * size, width: size, height: size }]}>
      <Animated.Text
        style={[
          styles.clueText,
          { fontSize: size * 0.42, color: hinted ? colors.gold : colors.text, transform: [{ scale: bounceScale }] },
        ]}
      >
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
