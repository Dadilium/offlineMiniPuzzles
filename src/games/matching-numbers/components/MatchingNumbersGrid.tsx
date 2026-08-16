import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  FadeOut,
  LinearTransition,
  interpolate,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Polyline } from 'react-native-svg';
import { BOARD_AREA_VERTICAL_PADDING } from '../../../components/GameScreenLayout';
import { fonts } from '../../../theme/tokens';
import { createThemedStyles } from '../../../theme/createThemedStyles';
import { useTheme } from '../../../theme/ThemeProvider';
import type { Cell, GridValue } from '../types';

const MAX_CELL = 46;
const screenWidth = Dimensions.get('window').width;
// GameScreenLayout's board area already applies its own 12px-per-side
// padding; this is just a small cushion on top of that.
const HORIZONTAL_MARGIN = 32;

function cellSizeFor(cols: number) {
  return Math.min(MAX_CELL, Math.floor((screenWidth - HORIZONTAL_MARGIN) / cols));
}

function cellKey(cell: Cell): string {
  return `${cell.r},${cell.c}`;
}

const LINE_GROW_MS = 180;
// Zoom-in / zoom-out pulse on the matched pair once the connecting line
// finishes drawing -- split evenly between the up-swing and the down-swing.
const PULSE_MS = 220;
const FADE_MS = 160;
const SHAKE_MS = 400;
// Add Numbers' newly-appended cells pop in one at a time rather than all at
// once -- APPEAR_STAGGER_MS is the delay between each successive cell in
// reading order, APPEAR_MS is how long each individual cell's own pop takes.
const APPEAR_STAGGER_MS = 45;
const APPEAR_MS = 200;
// How long a fully-cleared row's exit/reflow animation takes -- purely
// decorative now (see the `layout`/`exiting` props below): GameScreen removes
// an emptied row from `board` the instant it notices, with no artificial
// hold, so this duration only governs how long Reanimated spends smoothing
// the visual transition, not when the data actually changes.
export const ROW_COLLAPSE_MS = 220;

const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);

interface CellProps {
  value: number;
  size: number;
  selected: boolean;
  pulsing: boolean;
  clearing: boolean;
  rejected: boolean;
  /** Non-null for a cell that just appeared via Add Numbers -- how long to
   * wait before popping in, staggering it after earlier cells in the same
   * batch. Fixed for the cell's lifetime (see MatchingNumbersGrid), so it
   * only ever plays once. */
  appearDelayMs: number | null;
  onPress: () => void;
}

function MatchingNumbersCell({ value, size, selected, pulsing, clearing, rejected, appearDelayMs, onPress }: CellProps) {
  const styles = useStyles();
  const scale = useSharedValue(1);
  const pulseScale = useSharedValue(1);
  const highlight = useSharedValue(0);
  const shakeX = useSharedValue(0);
  const rejectBlink = useSharedValue(0);
  const fade = useSharedValue(1);
  const appearScale = useSharedValue(appearDelayMs == null ? 1 : 0);
  const appearOpacity = useSharedValue(appearDelayMs == null ? 1 : 0);

  // Reactive on `appearDelayMs`, not mount-once: this cell's (r, c) key can
  // get reused for a different board's content without unmounting (e.g. a
  // non-empty cell staying non-empty across a Retry) whenever React sees the
  // same key AND element type across the change -- a fully-empty cell always
  // remounts (it swaps to/from FillerCell, a different type), but a
  // still-filled one doesn't. A reused fiber keeps its shared values, so if
  // this position's still-pending appear-in animation from a moment ago
  // stayed queued while `appearDelayMs` flips to null underneath it (that
  // position no longer counts as newly appeared), waiting on the original
  // timer left it invisible for however much of the original stagger delay
  // was left -- long enough to read as a permanently blank/black cell if the
  // delay was large. Snapping straight to visible here instead removes that
  // wait entirely.
  useEffect(() => {
    if (appearDelayMs == null) {
      appearOpacity.value = 1;
      appearScale.value = 1;
      return;
    }
    appearOpacity.value = 0;
    appearScale.value = 0;
    const t = setTimeout(() => {
      appearOpacity.value = withTiming(1, { duration: APPEAR_MS });
      appearScale.value = withSpring(1, { duration: 260, dampingRatio: 0.75 });
    }, appearDelayMs);
    return () => clearTimeout(t);
  }, [appearDelayMs, appearOpacity, appearScale]);

  useEffect(() => {
    if (selected) {
      scale.value = withSequence(
        withSpring(1.15, { duration: 180, dampingRatio: 0.6 }),
        withSpring(1, { duration: 160, dampingRatio: 0.9 })
      );
      highlight.value = withTiming(1, { duration: 140 });
    } else {
      highlight.value = withTiming(0, { duration: 140 });
    }
  }, [selected, scale, highlight]);

  useEffect(() => {
    if (!rejected) {
      shakeX.value = 0;
      rejectBlink.value = 0;
      return;
    }
    shakeX.value = withSequence(
      withTiming(1, { duration: 40 }),
      withTiming(-1, { duration: 60 }),
      withTiming(1, { duration: 60 }),
      withTiming(0, { duration: 50 })
    );
    rejectBlink.value = withSequence(
      withTiming(1, { duration: 90 }),
      withTiming(0, { duration: 220 })
    );
  }, [rejected, shakeX, rejectBlink]);

  useEffect(() => {
    if (!pulsing) {
      pulseScale.value = 1;
      return;
    }
    pulseScale.value = withSequence(
      withTiming(1.3, { duration: PULSE_MS / 2 }),
      withTiming(1, { duration: PULSE_MS / 2 })
    );
  }, [pulsing, pulseScale]);

  useEffect(() => {
    if (clearing) {
      fade.value = withTiming(0, { duration: FADE_MS });
      scale.value = withTiming(0.6, { duration: FADE_MS });
    } else {
      fade.value = 1;
      scale.value = 1;
    }
  }, [clearing, fade, scale]);

  const cellAnimatedStyle = useAnimatedStyle(() => ({
    opacity: fade.value * appearOpacity.value,
    transform: [
      { scale: scale.value * pulseScale.value * appearScale.value },
      { translateX: interpolate(shakeX.value, [-1, 1], [-6, 6]) },
    ],
  }));
  const highlightStyle = useAnimatedStyle(() => ({ opacity: highlight.value }));
  const rejectOverlayStyle = useAnimatedStyle(() => ({ opacity: rejectBlink.value }));

  return (
    <Animated.View style={[styles.cellOuter, { width: size, height: size }, cellAnimatedStyle]}>
      <View style={styles.cellBase}>
        <Animated.View pointerEvents="none" style={[styles.highlight, highlightStyle]} />
        <Animated.View pointerEvents="none" style={[styles.rejectOverlay, rejectOverlayStyle]} />
        <Text style={[styles.digit, { fontSize: size * 0.58 }]}>{value}</Text>
      </View>
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={0.7} onPress={onPress} />
    </Animated.View>
  );
}

/** Non-pressable placeholder shown below the real board so it always visually
 * fills the available screen height, regardless of how few rows a given
 * difficulty actually needs. */
function FillerCell({ size }: { size: number }) {
  const styles = useStyles();
  return (
    <View style={[styles.cellOuter, { width: size, height: size }]}>
      <View style={styles.placeholderCell} />
    </View>
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
  /** Stable per-row identity, parallel to `board` (same length, same order) --
   * see GameScreen's rowIdsRef for how these are maintained. Used as each
   * real row's React key INSTEAD OF its array index, so a row that collapses
   * out of the middle of the board doesn't reassign every surviving row's
   * identity (which otherwise breaks Reanimated's `layout`/`exiting`
   * transitions below -- they need to see "row 2 left" rather than "row 2's
   * content silently changed and the last row vanished"). */
  rowIds: number[];
  /** "r,c" keys currently showing the selection highlight -- covers both the
   * single tap-to-select cell and a Hint's two-cell pulse. */
  highlightedCells: Set<string>;
  pendingMatch: PendingMatch | null;
  rejectedPair: [Cell, Cell] | null;
  onCellPress: (r: number, c: number) => void;
  onMatchAnimationDone: () => void;
  onRejectAnimationDone: () => void;
  /** Rendered height of the board's containing area, from GameScreenLayout's
   * onBoardAreaLayout. Used to pad the board out with placeholder rows below
   * the real ones so it always fills the screen the same way regardless of
   * difficulty. Omit (or 0) to render only the real board. */
  availableHeight?: number;
  /** Stable ids (from `rowIds`) of the rows Add Numbers most recently
   * appended, in append order, if any -- their cells pop in with a staggered
   * entrance instead of appearing instantly. Keyed by id rather than current
   * row position: a row's position shifts every time an unrelated row above
   * it collapses, but its id doesn't, so this keeps a cell's stagger delay
   * fixed for its whole pop-in regardless of how many collapses happen while
   * it's mid-animation (recomputing the delay from position instead would
   * change its value mid-flight and restart the pop-in from scratch every
   * time -- exactly the bug this replaced). Empty once nothing's pending. */
  appearRowIds?: number[];
}

export default function MatchingNumbersGrid({
  board,
  rowIds,
  highlightedCells,
  pendingMatch,
  rejectedPair,
  onCellPress,
  onMatchAnimationDone,
  onRejectAnimationDone,
  availableHeight = 0,
  appearRowIds = [],
}: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  const size = cellSizeFor(cols);
  const W = size * cols;

  const usableHeight = Math.max(0, availableHeight - BOARD_AREA_VERTICAL_PADDING * 2);
  const fillerRows = size > 0 ? Math.max(0, Math.floor(usableHeight / size) - rows) : 0;
  const H = size * (rows + fillerRows);

  const lineProgress = useSharedValue(0);
  const lineOpacity = useSharedValue(1);
  const prevPendingKey = useRef<string | null>(null);
  // Drives the 3-beat match animation: draw the connecting line, pulse the
  // pair once it's reached, then fade everything (line + cells) out together.
  const [matchStage, setMatchStage] = useState<'line' | 'pulse' | 'clear'>('line');

  useEffect(() => {
    if (!pendingMatch) {
      prevPendingKey.current = null;
      return;
    }
    const k = `${cellKey(pendingMatch.a)}-${cellKey(pendingMatch.b)}`;
    if (prevPendingKey.current === k) return;
    prevPendingKey.current = k;
    lineProgress.value = 0;
    lineOpacity.value = 1;
    setMatchStage('line');

    let pulseTimer: ReturnType<typeof setTimeout> | undefined;
    let clearTimer: ReturnType<typeof setTimeout> | undefined;

    // Runs on the JS thread once the line-grow animation's completion
    // callback (UI thread) hands control back via runOnJS -- it touches
    // React state and schedules the follow-up JS timers, so it can't run
    // directly on the UI thread.
    const startPulsePhase = () => {
      setMatchStage('pulse');
      pulseTimer = setTimeout(() => {
        setMatchStage('clear');
        lineOpacity.value = withTiming(0, { duration: FADE_MS });
        clearTimer = setTimeout(() => onMatchAnimationDone(), FADE_MS);
      }, PULSE_MS);
    };

    lineProgress.value = withTiming(1, { duration: LINE_GROW_MS }, () => {
      runOnJS(startPulsePhase)();
    });

    return () => {
      clearTimeout(pulseTimer);
      clearTimeout(clearTimer);
    };
    // onMatchAnimationDone intentionally excluded -- it closes over state
    // that changes every render; re-running this effect off its identity
    // would restart the animation mid-flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMatch, lineProgress, lineOpacity]);

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

  // Keeps both cells looking "selected" while the connecting line draws,
  // instead of the highlight vanishing the instant the second cell is tapped
  // and only reappearing once the line finishes (as a pulse).
  const lineKeys = new Set(pendingMatch && matchStage === 'line' ? [cellKey(pendingMatch.a), cellKey(pendingMatch.b)] : []);
  const pulseKeys = new Set(pendingMatch && matchStage === 'pulse' ? [cellKey(pendingMatch.a), cellKey(pendingMatch.b)] : []);
  const clearingKeys = new Set(pendingMatch && matchStage === 'clear' ? [cellKey(pendingMatch.a), cellKey(pendingMatch.b)] : []);
  const rejectedKeys = new Set(rejectedPair ? [cellKey(rejectedPair[0]), cellKey(rejectedPair[1])] : []);
  // Row id -> its position within the last-appended batch, for the stagger
  // order below -- see the `appearRowIds` prop doc for why this is id-based.
  const appearOrderById = new Map(appearRowIds.map((id, idx) => [id, idx]));

  const rowViews: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    const cellViews: React.ReactNode[] = [];
    for (let c = 0; c < cols; c++) {
      const v = board[r][c];
      const k = `${r},${c}`;
      if (v === null) {
        // Same placeholder look as a trailing filler cell -- keeps an empty
        // cell visually anchored (rather than invisible void) so the shift-up
        // collapse animation reads as content sliding into the next slot
        // instead of numbers appearing to land on top of nothing.
        cellViews.push(<FillerCell key={k} size={size} />);
        continue;
      }
      const appearOrder = appearOrderById.get(rowIds[r]);
      const appearDelayMs = appearOrder != null ? (appearOrder * cols + c) * APPEAR_STAGGER_MS : null;
      cellViews.push(
        <MatchingNumbersCell
          key={k}
          value={v}
          size={size}
          selected={highlightedCells.has(k) || lineKeys.has(k)}
          pulsing={pulseKeys.has(k)}
          clearing={clearingKeys.has(k)}
          rejected={rejectedKeys.has(k)}
          appearDelayMs={appearDelayMs}
          onPress={() => onCellPress(r, c)}
        />
      );
    }
    // Keyed by the row's stable id (see the `rowIds` prop doc), not `r` --
    // when this row is the one that just collapsed, that's what lets
    // Reanimated see it as "this specific row exited" (playing `exiting`)
    // while every other row is recognized as the SAME row merely moving to a
    // new slot (animated by `layout`), instead of every row's identity
    // reshuffling down by one.
    rowViews.push(
      <Animated.View key={rowIds[r]} style={styles.row} layout={LinearTransition.duration(ROW_COLLAPSE_MS)} exiting={FadeOut.duration(ROW_COLLAPSE_MS)}>
        {cellViews}
      </Animated.View>
    );
  }
  for (let r = 0; r < fillerRows; r++) {
    const cellViews: React.ReactNode[] = [];
    for (let c = 0; c < cols; c++) {
      cellViews.push(<FillerCell key={`filler-${r}-${c}`} size={size} />);
    }
    // Filler rows are interchangeable placeholders (no content identity to
    // preserve), so a plain positional key is fine here.
    rowViews.push(
      <Animated.View key={`filler-row-${r}`} style={styles.row} layout={LinearTransition.duration(ROW_COLLAPSE_MS)}>
        {cellViews}
      </Animated.View>
    );
  }

  const pathPoints = pendingMatch ? pendingMatch.path.map((cell) => `${cell.c * size + size / 2},${cell.r * size + size / 2}`).join(' ') : '';
  const totalLen = pendingMatch ? pathPixelLength(pendingMatch.path, size) : 0;
  const lineOpacityStyle = useAnimatedStyle(() => ({ opacity: lineOpacity.value }));
  const lineAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(lineProgress.value, [0, 1], [totalLen, 0]),
  }));

  return (
    <View style={[styles.wrap, { width: W, height: H }]}>
      <View>{rowViews}</View>
      {pendingMatch && (
        <Animated.View style={[StyleSheet.absoluteFill, lineOpacityStyle]} pointerEvents="none">
          <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
            <AnimatedPolyline
              points={pathPoints}
              fill="none"
              stroke={colors.success}
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={`${totalLen} ${totalLen}`}
              animatedProps={lineAnimatedProps}
            />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  wrap: { alignSelf: 'center' },
  row: { flexDirection: 'row' },
  cellOuter: { padding: 0.5 },
  cellBase: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  highlight: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(168,85,247,0.35)', borderRadius: 8 },
  rejectOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,92,92,0.45)', borderRadius: 8 },
  digit: { fontWeight: '700', color: colors.text, fontFamily: fonts.display },
  placeholderCell: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: colors.surface2,
    opacity: 0.3,
  },
}));
