import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, TouchableOpacity, View } from 'react-native';
import Svg, { G, Path, Rect, type GProps } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  FadeIn,
  FadeOut,
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/ThemeProvider';
import { createThemedStyles } from '../../../theme/createThemedStyles';
import { arrowNearPoint, buildOwnerGrid, COMBO_IDLE, nextCombo, sparkleCountFor } from '../engine';
import { arrowsPalette } from '../palette';
import type { ArrowsLevel, LaunchOutcome } from '../types';
import { arrowGeometry, strokeWidthFor, type ArrowGeometry } from './arrowGeometry';
import MovingArrow, { type Motion } from './MovingArrow';

// `G` only takes `matrix` as a native prop (its JS props derive it from
// x/y/scale/transform), so it's typed in here to be driven straight from the
// UI thread -- the whole board pans/zooms as one vector transform, redrawn
// crisp at every zoom level rather than scaling a rasterized snapshot.
// It must get NO transform props from React: any x/y/transform makes every
// re-render (each tap) send a static matrix that can override the animated
// one under Fabric -- the board snaps back to fit on screen while taps keep
// resolving against the zoomed transform.
const AnimatedG = Animated.createAnimatedComponent(G as unknown as React.ComponentClass<GProps & { matrix?: number[] }>);

/** Breathing room around the board inside the viewport, in pt. */
const VIEWPORT_PAD = 10;
/** Largest base cell -- small boards don't balloon to fill a tall screen. */
const MAX_CELL = 46;
/** Cell size zooming in is allowed to reach -- comfortably above a fingertip. */
const MAX_ZOOMED_CELL = 58;
const MIN_MAX_SCALE = 1.6;
/** Plate margin around the outermost cells, in cells. */
const PLATE_MARGIN = 0.35;
const DANGER_FLASH_MS = 520;

interface ActiveMotion extends Motion {
  /** Remounts the animation if the same arrow is launched again later (a fresh bump). */
  key: number;
  hint: boolean;
  /** Arrow a bump hits -- flashes red alongside the tapped one at impact. */
  blockerId: number | null;
}

export interface ArrowsBoardHandle {
  /** Of `ids`, the arrow nearest the center of what's currently on screen --
   * so a hint launches something the player can actually see when zoomed. */
  pickVisible: (ids: number[]) => number;
  /** Animates an already-resolved launch (used for hints). */
  play: (outcome: LaunchOutcome, opts?: { hint?: boolean }) => void;
}

interface Props {
  level: ArrowsLevel;
  removed: number[];
  /** Input off (out of hearts, solved) -- taps are ignored, zoom still works. */
  disabled: boolean;
  /** Resolves a tap against fresh game state; null = nothing to do. */
  onTapArrow: (arrowId: number) => LaunchOutcome | null;
  /** The moment a bumping arrow hits its blocker. */
  onBumpImpact: (arrowId: number) => void;
  /** True once solved -- the board plays its finish pulse as soon as every arrow has finished flying out. */
  celebrate: boolean;
  onCelebrationDone?: () => void;
}

interface Fit {
  cell: number;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
  maxScale: number;
}

function fitFor(level: ArrowsLevel, viewportWidth: number, viewportHeight: number): Fit {
  const cell = Math.min(MAX_CELL, (viewportWidth - VIEWPORT_PAD * 2) / level.cols, (viewportHeight - VIEWPORT_PAD * 2) / level.rows);
  return {
    cell,
    width: cell * level.cols,
    height: cell * level.rows,
    viewportWidth,
    viewportHeight,
    maxScale: Math.max(MIN_MAX_SCALE, MAX_ZOOMED_CELL / cell),
  };
}

/** Allowed translation range on one axis: centered while the board fits, edge-to-edge (plus padding) once it overflows. */
function axisBounds(content: number, viewport: number): [number, number] {
  'worklet';
  if (content <= viewport - VIEWPORT_PAD * 2) {
    const centered = (viewport - content) / 2;
    return [centered, centered];
  }
  return [viewport - content - VIEWPORT_PAD, VIEWPORT_PAD];
}

function clamp(value: number, [min, max]: [number, number]): number {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

const ArrowsBoard = forwardRef<ArrowsBoardHandle, Props>(function ArrowsBoard(
  { level, removed, disabled, onTapArrow, onBumpImpact, celebrate, onCelebrationDone },
  ref
) {
  const { colors, scheme } = useTheme();
  const styles = useStyles();
  const { t } = useTranslation('arrows');
  const palette = useMemo(() => arrowsPalette(colors, scheme), [colors, scheme]);
  const [viewport, setViewport] = useState<{ width: number; height: number } | null>(null);
  const fit = useMemo(() => (viewport ? fitFor(level, viewport.width, viewport.height) : null), [level, viewport]);

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    if (!viewport || Math.abs(viewport.width - width) > 0.5 || Math.abs(viewport.height - height) > 0.5) setViewport({ width, height });
  }

  // ---- Zoom / pan (UI thread) -------------------------------------------
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const pinchPrev = useSharedValue(1);
  const boardW = useSharedValue(0);
  const boardH = useSharedValue(0);
  const viewW = useSharedValue(0);
  const viewH = useSharedValue(0);
  const maxScale = useSharedValue(MIN_MAX_SCALE);
  /** 0 until the first transform lands -- the board stays hidden rather than flashing at the origin. */
  const placed = useSharedValue(0);
  const [zoomed, setZoomed] = useState(false);
  const lastFit = useRef<{ level: ArrowsLevel; cell: number } | null>(null);

  // Snap back to "whole board fits" for a new board or a new cell size. A
  // re-measure that keeps the same board and cell size (the viewport only
  // shifting a little) keeps the player's zoom and just re-clamps the pan.
  useEffect(() => {
    if (!fit) return;
    const keepZoom = lastFit.current?.level === level && lastFit.current.cell === fit.cell;
    lastFit.current = { level, cell: fit.cell };
    boardW.value = fit.width;
    boardH.value = fit.height;
    viewW.value = fit.viewportWidth;
    viewH.value = fit.viewportHeight;
    maxScale.value = fit.maxScale;
    if (keepZoom) {
      tx.value = clamp(tx.value, axisBounds(fit.width * scale.value, fit.viewportWidth));
      ty.value = clamp(ty.value, axisBounds(fit.height * scale.value, fit.viewportHeight));
    } else {
      scale.value = 1;
      tx.value = (fit.viewportWidth - fit.width) / 2;
      ty.value = (fit.viewportHeight - fit.height) / 2;
    }
    placed.value = 1;
  }, [fit, level, boardW, boardH, viewW, viewH, maxScale, placed, scale, tx, ty]);

  function clampTranslation(): void {
    'worklet';
    tx.value = clamp(tx.value, axisBounds(boardW.value * scale.value, viewW.value));
    ty.value = clamp(ty.value, axisBounds(boardH.value * scale.value, viewH.value));
  }

  useAnimatedReaction(
    () => scale.value > 1.02,
    (isZoomed, prev) => {
      if (isZoomed !== prev) runOnJS(setZoomed)(isZoomed);
    }
  );

  const resetZoom = useCallback(() => {
    if (!fit) return;
    cancelAnimation(tx);
    cancelAnimation(ty);
    scale.value = withTiming(1, { duration: 260 });
    tx.value = withTiming((fit.viewportWidth - fit.width) / 2, { duration: 260 });
    ty.value = withTiming((fit.viewportHeight - fit.height) / 2, { duration: 260 });
  }, [fit, scale, tx, ty]);

  // ---- Tap -> launch (JS thread) -----------------------------------------
  const owner = useMemo(() => buildOwnerGrid(level, new Set(removed)), [level, removed]);
  const [motions, setMotions] = useState<Record<number, ActiveMotion>>({});
  const [danger, setDanger] = useState<ReadonlySet<number>>(new Set());
  const motionKey = useRef(0);
  const dangerTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const motionsRef = useRef(motions);
  motionsRef.current = motions;
  const comboRef = useRef(COMBO_IDLE);

  useEffect(() => {
    const timers = dangerTimers.current;
    return () => timers.forEach((timer) => clearTimeout(timer));
  }, []);

  // A new level (Next / tier switch) drops whatever was mid-flight.
  useEffect(() => {
    setMotions({});
    setDanger(new Set());
    comboRef.current = COMBO_IDLE;
  }, [level]);

  const flashDanger = useCallback((ids: number[]) => {
    setDanger((prev) => new Set([...prev, ...ids]));
    for (const id of ids) {
      const existing = dangerTimers.current.get(id);
      if (existing) clearTimeout(existing);
      dangerTimers.current.set(
        id,
        setTimeout(() => {
          dangerTimers.current.delete(id);
          setDanger((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }, DANGER_FLASH_MS)
      );
    }
  }, []);

  const play = useCallback((outcome: LaunchOutcome, opts?: { hint?: boolean; sparkles?: number }) => {
    motionKey.current += 1;
    const motion: ActiveMotion = {
      kind: outcome.kind === 'exit' ? 'exit' : 'bump',
      clearCells: outcome.clearCells,
      sparkles: opts?.sparkles ?? 0,
      key: motionKey.current,
      hint: !!opts?.hint,
      blockerId: outcome.kind === 'blocked' ? outcome.blockerId : null,
    };
    setMotions((prev) => ({ ...prev, [outcome.arrowId]: motion }));
  }, []);

  const handleTap = useCallback(
    (x: number, y: number) => {
      if (disabledRef.current) return;
      // Arrows mid-flight or mid-bump are busy: a tap on one is swallowed, never passed to a neighbor.
      const busy = new Set(Object.keys(motionsRef.current).map(Number));
      const arrowId = arrowNearPoint(level, owner, x, y, busy);
      if (arrowId < 0) return;
      const outcome = onTapArrow(arrowId);
      if (!outcome) return;
      const exits = outcome.kind === 'exit';
      comboRef.current = nextCombo(comboRef.current, exits ? 'exit' : 'bump', Date.now());
      play(outcome, { sparkles: exits ? sparkleCountFor(comboRef.current.count) : 0 });
    },
    [level, owner, onTapArrow, play]
  );

  const handleImpact = useCallback(
    (arrowId: number, blockerId: number | null) => {
      flashDanger(blockerId === null ? [arrowId] : [arrowId, blockerId]);
      onBumpImpact(arrowId);
    },
    [flashDanger, onBumpImpact]
  );

  const handleMotionDone = useCallback((arrowId: number) => {
    setMotions((prev) => {
      const next = { ...prev };
      delete next[arrowId];
      return next;
    });
  }, []);

  // ---- Geometry -----------------------------------------------------------
  const geometries: ArrowGeometry[] | null = useMemo(
    () => (fit ? level.arrows.map((arrow) => arrowGeometry(arrow, level.cols, fit.cell)) : null),
    [level, fit]
  );

  useImperativeHandle(
    ref,
    () => ({
      pickVisible: (ids: number[]) => {
        if (!geometries || ids.length === 0) return ids[0] ?? -1;
        // Viewport center, mapped back into board points.
        const cx = (viewW.value / 2 - tx.value) / scale.value;
        const cy = (viewH.value / 2 - ty.value) / scale.value;
        let best = ids[0];
        let bestDist = Number.POSITIVE_INFINITY;
        for (const id of ids) {
          for (const p of geometries[id].points) {
            const dist = Math.hypot(p.x - cx, p.y - cy);
            if (dist < bestDist) {
              bestDist = dist;
              best = id;
            }
          }
        }
        return best;
      },
      play,
    }),
    [geometries, play, scale, tx, ty, viewW, viewH]
  );

  // ---- Win pulse -----------------------------------------------------------
  const pulse = useSharedValue(1);
  const celebratedRef = useRef(false);
  const flying = Object.keys(motions).length;
  useEffect(() => {
    if (!celebrate) {
      celebratedRef.current = false;
      return;
    }
    if (flying > 0 || celebratedRef.current) return;
    celebratedRef.current = true;
    resetZoom();
    pulse.value = withSequence(
      withSpring(1.04, { duration: 240, dampingRatio: 0.55 }),
      withSpring(1, { duration: 260, dampingRatio: 0.7 }, (finished) => {
        if (finished && onCelebrationDone) runOnJS(onCelebrationDone)();
      })
    );
  }, [celebrate, flying, onCelebrationDone, pulse, resetZoom]);

  // ---- Gestures ------------------------------------------------------------
  const pinch = Gesture.Pinch()
    .onStart(() => {
      pinchPrev.value = 1;
    })
    .onUpdate((e) => {
      const factor = e.scale / pinchPrev.value;
      pinchPrev.value = e.scale;
      const next = Math.min(maxScale.value, Math.max(1, scale.value * factor));
      const ratio = next / scale.value;
      // Keep the board point under the fingers' focal point pinned in place.
      tx.value = e.focalX - ratio * (e.focalX - tx.value);
      ty.value = e.focalY - ratio * (e.focalY - ty.value);
      scale.value = next;
      clampTranslation();
    });

  const pan = Gesture.Pan()
    .minDistance(8)
    .averageTouches(true)
    .onBegin(() => {
      cancelAnimation(tx);
      cancelAnimation(ty);
    })
    .onChange((e) => {
      tx.value += e.changeX;
      ty.value += e.changeY;
      clampTranslation();
    })
    .onEnd((e) => {
      tx.value = withDecay({ velocity: e.velocityX, clamp: axisBounds(boardW.value * scale.value, viewW.value) });
      ty.value = withDecay({ velocity: e.velocityY, clamp: axisBounds(boardH.value * scale.value, viewH.value) });
    });

  // Captured on its own so the tap worklet doesn't copy the whole level
  // (every arrow path) over to the UI thread on each render.
  const cols = level.cols;
  const tap = Gesture.Tap()
    .maxDistance(12)
    .onEnd((e, success) => {
      if (!success || boardW.value === 0) return;
      const cellSize = boardW.value / Math.max(1, cols);
      const x = (e.x - tx.value) / scale.value / cellSize;
      const y = (e.y - ty.value) / scale.value / cellSize;
      runOnJS(handleTap)(x, y);
    });

  const gesture = Gesture.Race(Gesture.Simultaneous(pinch, pan), tap);

  const zoomProps = useAnimatedProps(() => ({ matrix: [scale.value, 0, 0, scale.value, tx.value, ty.value] }));
  const pulseStyle = useAnimatedStyle(() => ({ opacity: placed.value, transform: [{ scale: pulse.value }] }));

  if (!fit || !geometries) {
    return <View style={styles.viewport} onLayout={onLayout} />;
  }

  const strokeWidth = strokeWidthFor(fit.cell);
  const plateInset = PLATE_MARGIN * fit.cell;

  return (
    <View style={styles.viewport} onLayout={onLayout}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[StyleSheet.absoluteFill, pulseStyle]}>
          <Svg width={fit.viewportWidth} height={fit.viewportHeight}>
            <AnimatedG animatedProps={zoomProps}>
              <Rect
                x={-plateInset}
                y={-plateInset}
                width={fit.width + plateInset * 2}
                height={fit.height + plateInset * 2}
                rx={fit.cell * 0.5}
                fill={palette.plate}
              />
              <StaticArrows
                geometries={geometries}
                removed={removed}
                motions={motions}
                danger={danger}
                color={palette.line}
                dangerColor={palette.danger}
                strokeWidth={strokeWidth}
              />
              {Object.entries(motions).map(([key, motion]) => {
                const id = Number(key);
                return (
                  <MovingArrow
                    key={`${id}-${motion.key}`}
                    geometry={geometries[id]}
                    motion={motion}
                    cell={fit.cell}
                    strokeWidth={strokeWidth}
                    color={motion.hint ? palette.hint : danger.has(id) ? palette.danger : motion.kind === 'exit' ? palette.success : palette.line}
                    sparkleColor={palette.sparkle}
                    onImpact={() => handleImpact(id, motion.blockerId)}
                    onDone={() => handleMotionDone(id)}
                  />
                );
              })}
            </AnimatedG>
          </Svg>
        </Animated.View>
      </GestureDetector>

      {zoomed && (
        <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(160)} style={styles.fitButtonWrap}>
          <TouchableOpacity onPress={resetZoom} style={styles.fitButton} accessibilityLabel={t('game.fitBoard')} activeOpacity={0.8}>
            <Ionicons name="contract" size={18} color={colors.text} />
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
});

interface StaticArrowsProps {
  geometries: ArrowGeometry[];
  removed: number[];
  motions: Record<number, ActiveMotion>;
  danger: ReadonlySet<number>;
  color: string;
  dangerColor: string;
  strokeWidth: number;
}

/**
 * Every arrow at rest, merged into one body path + one head path per color
 * -- a big board has 100+ arrows, and redrawing two paths per zoom frame is
 * far cheaper than redrawing hundreds of separate elements. Moving arrows
 * are drawn by `MovingArrow` instead, so they're skipped here.
 */
const StaticArrows = React.memo(function StaticArrows({ geometries, removed, motions, danger, color, dangerColor, strokeWidth }: StaticArrowsProps) {
  const layers = useMemo(() => {
    const removedSet = new Set(removed);
    const normal = { bodies: '', heads: '' };
    const flashing = { bodies: '', heads: '' };
    geometries.forEach((geometry, id) => {
      if (removedSet.has(id) || motions[id]) return;
      const layer = danger.has(id) ? flashing : normal;
      layer.bodies += geometry.bodyD;
      layer.heads += geometry.headD;
    });
    return { normal, flashing };
  }, [geometries, removed, motions, danger]);

  return (
    <>
      <ArrowLayer bodies={layers.normal.bodies} heads={layers.normal.heads} color={color} strokeWidth={strokeWidth} />
      <ArrowLayer bodies={layers.flashing.bodies} heads={layers.flashing.heads} color={dangerColor} strokeWidth={strokeWidth} />
    </>
  );
});

function ArrowLayer({ bodies, heads, color, strokeWidth }: { bodies: string; heads: string; color: string; strokeWidth: number }) {
  if (!bodies) return null;
  return (
    <>
      <Path d={bodies} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d={heads} fill={color} />
    </>
  );
}

const useStyles = createThemedStyles((colors) => ({
  viewport: { flex: 1, alignSelf: 'stretch', overflow: 'hidden' },
  fitButtonWrap: { position: 'absolute', right: 10, bottom: 10 },
  fitButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
}));

export default ArrowsBoard;
