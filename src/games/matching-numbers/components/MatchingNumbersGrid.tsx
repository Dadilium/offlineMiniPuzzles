import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { BOARD_AREA_VERTICAL_PADDING } from '../../../components/GameScreenLayout';
import { colors, fonts } from '../../../theme/colors';
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
// How long a fully-cleared row's shift-up collapse animation takes. Exported
// so GameScreen can time the actual row removal (engine.removeRow) to land
// exactly when the animation finishes.
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
  const scale = useRef(new Animated.Value(1)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;
  const highlight = useRef(new Animated.Value(0)).current;
  const shakeX = useRef(new Animated.Value(0)).current;
  const rejectBlink = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const appearScale = useRef(new Animated.Value(appearDelayMs == null ? 1 : 0)).current;
  const appearOpacity = useRef(new Animated.Value(appearDelayMs == null ? 1 : 0)).current;

  useEffect(() => {
    if (appearDelayMs == null) return;
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(appearOpacity, { toValue: 1, duration: APPEAR_MS, useNativeDriver: true }),
        Animated.spring(appearScale, { toValue: 1, friction: 5, tension: 200, useNativeDriver: true }),
      ]).start();
    }, appearDelayMs);
    return () => clearTimeout(t);
    // Runs once per cell instance, at mount -- appearDelayMs is fixed for
    // this cell's whole lifetime (see MatchingNumbersGrid).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selected) {
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.15, friction: 4, tension: 200, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 5, tension: 220, useNativeDriver: true }),
      ]).start();
      Animated.timing(highlight, { toValue: 1, duration: 140, useNativeDriver: true }).start();
    } else {
      Animated.timing(highlight, { toValue: 0, duration: 140, useNativeDriver: true }).start();
    }
  }, [selected, scale, highlight]);

  useEffect(() => {
    if (!rejected) {
      shakeX.setValue(0);
      rejectBlink.setValue(0);
      return;
    }
    Animated.sequence([
      Animated.timing(shakeX, { toValue: 1, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.timing(rejectBlink, { toValue: 1, duration: 90, useNativeDriver: true }),
      Animated.timing(rejectBlink, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [rejected, shakeX, rejectBlink]);

  useEffect(() => {
    if (!pulsing) {
      pulseScale.setValue(1);
      return;
    }
    Animated.sequence([
      Animated.timing(pulseScale, { toValue: 1.3, duration: PULSE_MS / 2, useNativeDriver: true }),
      Animated.timing(pulseScale, { toValue: 1, duration: PULSE_MS / 2, useNativeDriver: true }),
    ]).start();
  }, [pulsing, pulseScale]);

  useEffect(() => {
    if (clearing) {
      Animated.parallel([
        Animated.timing(fade, { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.6, duration: FADE_MS, useNativeDriver: true }),
      ]).start();
    } else {
      fade.setValue(1);
      scale.setValue(1);
    }
  }, [clearing, fade, scale]);

  const translateX = shakeX.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] });
  const combinedScale = Animated.multiply(Animated.multiply(scale, pulseScale), appearScale);
  const combinedOpacity = Animated.multiply(fade, appearOpacity);

  return (
    <Animated.View
      style={[styles.cellOuter, { width: size, height: size, opacity: combinedOpacity, transform: [{ scale: combinedScale }, { translateX }] }]}
    >
      <View style={styles.cellBase}>
        <Animated.View pointerEvents="none" style={[styles.highlight, { opacity: highlight }]} />
        <Animated.View pointerEvents="none" style={[styles.rejectOverlay, { opacity: rejectBlink }]} />
        <Text style={[styles.digit, { fontSize: size * 0.42 }]}>{value}</Text>
      </View>
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={0.7} onPress={onPress} />
    </Animated.View>
  );
}

/** Non-pressable placeholder shown below the real board so it always visually
 * fills the available screen height, regardless of how few rows a given
 * difficulty actually needs. */
function FillerCell({ size }: { size: number }) {
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
  /** Row index Add Numbers most recently appended from, if any -- cells at or
   * past this row pop in with a staggered entrance instead of appearing
   * instantly. Null once nothing's newly appended (the default board state). */
  appearFromRow?: number | null;
  /** Row index currently mid shift-up collapse (see engine.findFullyEmptyRow)
   * -- every row below it animates upward by one cell height. Null when no
   * row is currently collapsing. */
  collapsingRow?: number | null;
}

export default function MatchingNumbersGrid({
  board,
  highlightedCells,
  pendingMatch,
  rejectedPair,
  onCellPress,
  onMatchAnimationDone,
  onRejectAnimationDone,
  availableHeight = 0,
  appearFromRow = null,
  collapsingRow = null,
}: Props) {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  const size = cellSizeFor(cols);
  const W = size * cols;

  const usableHeight = Math.max(0, availableHeight - BOARD_AREA_VERTICAL_PADDING * 2);
  const fillerRows = size > 0 ? Math.max(0, Math.floor(usableHeight / size) - rows) : 0;
  // While a row is collapsing, every filler row shifts up right alongside the
  // real rows below it (they're always "below" any real collapsingRow index)
  // -- plus one extra filler row is rendered so there's already a placeholder
  // ready to slide into the slot the last real row vacates, instead of that
  // slot briefly showing bare background. Once the collapse actually removes
  // the row, `rows` drops by one and fillerRows recomputes to this same
  // total on its own, so the transition out of the animation is seamless.
  const renderedFillerRows = collapsingRow != null ? fillerRows + 1 : fillerRows;
  const H = size * (rows + renderedFillerRows);

  const lineProgress = useRef(new Animated.Value(0)).current;
  const lineOpacity = useRef(new Animated.Value(1)).current;
  const prevPendingKey = useRef<string | null>(null);
  const collapseShift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (collapsingRow == null) {
      collapseShift.setValue(0);
      return;
    }
    collapseShift.setValue(0);
    Animated.timing(collapseShift, { toValue: 1, duration: ROW_COLLAPSE_MS, useNativeDriver: true }).start();
  }, [collapsingRow, collapseShift]);
  const collapseTranslateY = collapseShift.interpolate({ inputRange: [0, 1], outputRange: [0, -size] });
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
    lineProgress.setValue(0);
    lineOpacity.setValue(1);
    setMatchStage('line');

    let pulseTimer: ReturnType<typeof setTimeout> | undefined;
    let clearTimer: ReturnType<typeof setTimeout> | undefined;

    Animated.timing(lineProgress, { toValue: 1, duration: LINE_GROW_MS, useNativeDriver: false }).start(() => {
      setMatchStage('pulse');
      pulseTimer = setTimeout(() => {
        setMatchStage('clear');
        Animated.timing(lineOpacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start();
        clearTimer = setTimeout(() => onMatchAnimationDone(), FADE_MS);
      }, PULSE_MS);
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

  const pulseKeys = new Set(pendingMatch && matchStage === 'pulse' ? [cellKey(pendingMatch.a), cellKey(pendingMatch.b)] : []);
  const clearingKeys = new Set(pendingMatch && matchStage === 'clear' ? [cellKey(pendingMatch.a), cellKey(pendingMatch.b)] : []);
  const rejectedKeys = new Set(rejectedPair ? [cellKey(rejectedPair[0]), cellKey(rejectedPair[1])] : []);

  const rowViews: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    const cellViews: React.ReactNode[] = [];
    for (let c = 0; c < cols; c++) {
      const v = board[r][c];
      const k = `${r},${c}`;
      if (v === null) {
        cellViews.push(<View key={k} style={{ width: size, height: size }} />);
        continue;
      }
      const appearDelayMs = appearFromRow != null && r >= appearFromRow ? ((r - appearFromRow) * cols + c) * APPEAR_STAGGER_MS : null;
      cellViews.push(
        <MatchingNumbersCell
          key={k}
          value={v}
          size={size}
          selected={highlightedCells.has(k)}
          pulsing={pulseKeys.has(k)}
          clearing={clearingKeys.has(k)}
          rejected={rejectedKeys.has(k)}
          appearDelayMs={appearDelayMs}
          onPress={() => onCellPress(r, c)}
        />
      );
    }
    const isBelowCollapsingRow = collapsingRow != null && r > collapsingRow;
    rowViews.push(
      <Animated.View
        key={r}
        style={[styles.row, isBelowCollapsingRow ? { transform: [{ translateY: collapseTranslateY }] } : null]}
      >
        {cellViews}
      </Animated.View>
    );
  }
  for (let r = 0; r < renderedFillerRows; r++) {
    const cellViews: React.ReactNode[] = [];
    for (let c = 0; c < cols; c++) {
      cellViews.push(<FillerCell key={`filler-${r}-${c}`} size={size} />);
    }
    rowViews.push(
      <Animated.View
        key={`filler-row-${r}`}
        style={[styles.row, collapsingRow != null ? { transform: [{ translateY: collapseTranslateY }] } : null]}
      >
        {cellViews}
      </Animated.View>
    );
  }

  const pathPoints = pendingMatch ? pendingMatch.path.map((cell) => `${cell.c * size + size / 2},${cell.r * size + size / 2}`).join(' ') : '';
  const totalLen = pendingMatch ? pathPixelLength(pendingMatch.path, size) : 0;

  return (
    <View style={[styles.wrap, { width: W, height: H }]}>
      <View>{rowViews}</View>
      {pendingMatch && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: lineOpacity }]} pointerEvents="none">
          <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
            <AnimatedPolyline
              points={pathPoints}
              fill="none"
              stroke={colors.success}
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={`${totalLen} ${totalLen}`}
              strokeDashoffset={lineProgress.interpolate({ inputRange: [0, 1], outputRange: [totalLen, 0] })}
            />
          </Svg>
        </Animated.View>
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
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  highlight: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(168,85,247,0.35)', borderRadius: 8 },
  rejectOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,92,92,0.45)', borderRadius: 8 },
  digit: { fontWeight: '700', color: colors.text, fontFamily: fonts.display },
  placeholderCell: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: colors.surface2,
    opacity: 0.3,
  },
});
