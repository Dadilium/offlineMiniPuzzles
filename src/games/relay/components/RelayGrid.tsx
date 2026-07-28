import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, StyleSheet, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { colors } from '../../../theme/colors';
import { CARDINAL_DIRECTIONS, isFixed, isMirror, isWall, traceBounceTo, traceCardinalBeam } from '../engine';
import { GRID_COLS, GRID_ROWS } from '../levels';
import type { ConnectivityResult, PlacedRelay, Point, RelayLevel, SignalColor } from '../types';

const MAX_CELL = 36;
const screenWidth = Dimensions.get('window').width;
const CELL = Math.min(MAX_CELL, Math.floor((screenWidth - 40) / GRID_COLS));

const SIGNAL_COLORS: Record<SignalColor, string> = { blue: colors.signalBlue, red: colors.signalRed };
const SIGNAL_COLORS_MUTED: Record<SignalColor, string> = { blue: colors.signalBlueMuted, red: colors.signalRedMuted };

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);
const AnimatedLine = Animated.createAnimatedComponent(Line);
export const GROW_DURATION_MS = 320;
const BOUNCE_UP_MS = 140;
const BOUNCE_DOWN_MS = 160;
// Total time from a signal connecting to its receiver's bounce fully
// settling: the grow-in delay before the bounce starts, plus the bounce
// itself. GameScreen waits this long before showing the win overlay.
export const RECEIVER_SETTLE_MS = GROW_DURATION_MS + BOUNCE_UP_MS + BOUNCE_DOWN_MS;

function toPx(v: number) {
  return v * CELL + CELL / 2;
}

function pointsAttr(pts: Point[]) {
  return pts.map((p) => `${toPx(p.x)},${toPx(p.y)}`).join(' ');
}


function pathPixelLength(pts: Point[]): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += Math.hypot(toPx(pts[i].x) - toPx(pts[i - 1].x), toPx(pts[i].y) - toPx(pts[i - 1].y));
  }
  return total;
}

/**
 * Tracks a "just placed" grow-in animation per relay cell, keyed by
 * `x,y`. New relays start their Animated.Value at 0 and animate to 1 once
 * (never replayed on later re-renders caused by other relays changing);
 * removed relays are cleaned up so re-placing one later grows in fresh.
 * Reach indicators for the source itself never use this -- only relays.
 */
function useRelayGrowth(relays: PlacedRelay[]) {
  const animsRef = useRef(new Map<string, Animated.Value>());
  const startedRef = useRef(new Set<string>());
  const growingRef = useRef(new Set<string>());
  const [, forceRender] = useState(0);

  const currentKeys = new Set(relays.map((r) => `${r.x},${r.y}`));

  // Synchronous ref bookkeeping during render: idempotent (guarded by
  // `has()` checks) so it's safe even if render runs twice, and it means
  // the very first paint of a new relay already shows it at its 0 starting
  // point instead of popping in at full size before the effect kicks in.
  currentKeys.forEach((key) => {
    if (!animsRef.current.has(key)) {
      animsRef.current.set(key, new Animated.Value(0));
      growingRef.current.add(key);
    }
  });
  Array.from(animsRef.current.keys()).forEach((key) => {
    if (!currentKeys.has(key)) {
      animsRef.current.delete(key);
      startedRef.current.delete(key);
      growingRef.current.delete(key);
    }
  });

  useEffect(() => {
    currentKeys.forEach((key) => {
      if (startedRef.current.has(key)) return;
      startedRef.current.add(key);
      const anim = animsRef.current.get(key);
      if (!anim) return;
      Animated.timing(anim, { toValue: 1, duration: GROW_DURATION_MS, useNativeDriver: false }).start(() => {
        growingRef.current.delete(key);
        forceRender((n) => n + 1);
      });
    });
    // relays is the only thing that should re-trigger this scan
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relays]);

  return {
    getAnim: (key: string) => animsRef.current.get(key),
    isGrowing: (key: string) => growingRef.current.has(key),
  };
}

/**
 * Bounces a receiver's ring/dot once its color's signal actually connects.
 * Fires GROW_DURATION_MS after `receiverReached` flips true, so it lands
 * just as the final relay's grow-in animation finishes rather than
 * overlapping it. Resets (so it can bounce again) if the level is reset
 * and the receiver goes back to unreached.
 */
function useReceiverBounce(results: Partial<Record<SignalColor, ConnectivityResult>>) {
  const animsRef = useRef(new Map<SignalColor, Animated.Value>());
  const reachedRef = useRef(new Set<SignalColor>());

  (Object.keys(results) as SignalColor[]).forEach((color) => {
    if (!animsRef.current.has(color)) animsRef.current.set(color, new Animated.Value(1));
  });

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    (Object.keys(results) as SignalColor[]).forEach((color) => {
      const reached = !!results[color]?.receiverReached;
      const anim = animsRef.current.get(color);
      if (reached && !reachedRef.current.has(color)) {
        reachedRef.current.add(color);
        if (!anim) return;
        timers.push(
          setTimeout(() => {
            Animated.sequence([
              Animated.timing(anim, { toValue: 1.4, duration: BOUNCE_UP_MS, useNativeDriver: false }),
              Animated.timing(anim, { toValue: 1, duration: BOUNCE_DOWN_MS, useNativeDriver: false }),
            ]).start();
          }, GROW_DURATION_MS)
        );
      } else if (!reached) {
        reachedRef.current.delete(color);
        anim?.setValue(1);
      }
    });
    return () => timers.forEach(clearTimeout);
  }, [results]);

  return (color: SignalColor) => animsRef.current.get(color);
}

interface Props {
  level: RelayLevel;
  relays: PlacedRelay[];
  jammed: Set<number>;
  results: Partial<Record<SignalColor, ConnectivityResult>>;
  onCellPress: (x: number, y: number) => void;
}

export default function RelayGrid({ level, relays, jammed, results, onCellPress }: Props) {
  const W = GRID_COLS * CELL;
  const H = GRID_ROWS * CELL;
  const { getAnim, isGrowing } = useRelayGrowth(relays);
  const getBounceAnim = useReceiverBounce(results);

  const cells = [];
  const mirrors: React.ReactNode[] = [];
  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      const wall = isWall(x, y, level);
      const fixed = isFixed(x, y, level);
      const mirror = isMirror(x, y, level);
      cells.push(
        <TouchableOpacity
          key={`${x}-${y}`}
          activeOpacity={wall || fixed || mirror ? 1 : 0.6}
          disabled={wall || fixed || !!mirror}
          onPress={() => onCellPress(x, y)}
          style={[
            styles.cell,
            { width: CELL, height: CELL, left: x * CELL, top: y * CELL },
            wall && styles.cellWall,
            mirror && styles.cellMirror,
          ]}
        />
      );
      if (mirror) {
        const cx = x * CELL;
        const cy = y * CELL;
        const inset = CELL * 0.2;
        mirrors.push(
          mirror.orientation === 'fwd' ? (
            <Line
              key={`mirror-${x}-${y}`}
              x1={cx + inset}
              y1={cy + CELL - inset}
              x2={cx + CELL - inset}
              y2={cy + inset}
              stroke={colors.gold}
              strokeWidth={3}
              strokeLinecap="round"
            />
          ) : (
            <Line
              key={`mirror-${x}-${y}`}
              x1={cx + inset}
              y1={cy + inset}
              x2={cx + CELL - inset}
              y2={cy + CELL - inset}
              stroke={colors.gold}
              strokeWidth={3}
              strokeLinecap="round"
            />
          )
        );
      }
    }
  }

  const hasMirrors = (level.mirrors ?? []).length > 0;

  const svgParts: React.ReactNode[] = [];
  level.sources.forEach((s) => {
    const r = results[s.color];
    if (!r) return;
    const col = SIGNAL_COLORS[s.color];
    r.nodes.forEach((node, i) => {
      if (!r.connected[i]) return;
      // Node 0 is always the source itself -- it's on the board from the
      // moment the level opens, so its reach never grows in. Only relays
      // (i > 0), which the player actively places, get the animation.
      const growthKey = i > 0 ? `${node.x},${node.y}` : null;
      const anim = growthKey ? getAnim(growthKey) : undefined;
      const animating = !!(growthKey && anim && isGrowing(growthKey));

      // A node's `kind` gates which preview(s) it actually gets: 'circle'
      // only the omnidirectional range ring, 'beam' only the cardinal beam
      // lines, `undefined` (the source, or a relay placed before this
      // mechanic shipped) both -- matching canReach's own kind dispatch
      // exactly, so the preview never shows a capability the node doesn't
      // actually have.
      const showCircle = node.kind === undefined || node.kind === 'circle';
      const showBeam = hasMirrors && (node.kind === undefined || node.kind === 'beam');
      // Both previews sharing one node (only ever the source/legacy case)
      // get dimmed so neither drowns the other out; a single-kind node gets
      // its one preview at full strength since there's nothing to compete with.
      const shared = showCircle && showBeam;

      if (showCircle) {
        if (shared) {
          if (animating && anim) {
            svgParts.push(
              <AnimatedCircle
                key={`range-${s.color}-${i}`}
                cx={toPx(node.x)}
                cy={toPx(node.y)}
                r={anim.interpolate({ inputRange: [0, 1], outputRange: [0, node.range * CELL] })}
                fill="none"
                stroke={col}
                strokeOpacity={0.15}
                strokeDasharray="4,4"
              />
            );
          } else {
            svgParts.push(
              <Circle
                key={`range-${s.color}-${i}`}
                cx={toPx(node.x)}
                cy={toPx(node.y)}
                r={node.range * CELL}
                fill="none"
                stroke={col}
                strokeOpacity={0.15}
                strokeDasharray="4,4"
              />
            );
          }
        } else if (animating && anim) {
          svgParts.push(
            <AnimatedCircle
              key={`range-${s.color}-${i}`}
              cx={toPx(node.x)}
              cy={toPx(node.y)}
              r={anim.interpolate({ inputRange: [0, 1], outputRange: [0, node.range * CELL] })}
              fill={col}
              fillOpacity={0.06}
              stroke={col}
              strokeOpacity={0.35}
              strokeDasharray="4,4"
            />
          );
        } else {
          svgParts.push(
            <Circle
              key={`range-${s.color}-${i}`}
              cx={toPx(node.x)}
              cy={toPx(node.y)}
              r={node.range * CELL}
              fill={col}
              fillOpacity={0.06}
              stroke={col}
              strokeOpacity={0.35}
              strokeDasharray="4,4"
            />
          );
        }
      }

      if (showBeam) {
        const beamOpacity = shared ? 0.3 : 0.5;
        CARDINAL_DIRECTIONS.forEach((dir) => {
          const pts = traceCardinalBeam(node, dir, node.range, level);
          if (pts.length <= 1) return;
          if (animating && anim) {
            const total = pathPixelLength(pts);
            svgParts.push(
              <AnimatedPolyline
                key={`beam-${s.color}-${i}-${dir}`}
                points={pointsAttr(pts)}
                fill="none"
                stroke={col}
                strokeWidth={1.5}
                strokeOpacity={beamOpacity}
                strokeDasharray={`${total} ${total}`}
                strokeDashoffset={anim.interpolate({ inputRange: [0, 1], outputRange: [total, 0] })}
              />
            );
          } else {
            svgParts.push(
              <Polyline
                key={`beam-${s.color}-${i}-${dir}`}
                points={pointsAttr(pts)}
                fill="none"
                stroke={col}
                strokeWidth={1.5}
                strokeOpacity={beamOpacity}
                strokeDasharray="4,4"
              />
            );
          }
        });
      }

      if (i > 0 && r.parent[i] >= 0) {
        const p = r.nodes[r.parent[i]];
        // r.bouncePaths[i] is only set when the connectivity engine's plain
        // LOS check failed and it fell back to a mirror bounce -- but a real
        // beam route can still exist even when the plain check succeeded
        // first (it short-circuits, so it never bothers computing one). Ask
        // traceBounceTo directly so rendering always prefers the real beam
        // path over a diagonal cut whenever one exists -- but only for a
        // node that can actually use a bounce ('beam' or the dual-mode
        // source/legacy relay); a 'circle'-typed node must never show a
        // bent path it has no capability to take.
        const canBounce = node.kind === undefined || node.kind === 'beam';
        const beamPath = r.bouncePaths[i] ?? (canBounce ? traceBounceTo(p, node, level) : null);
        const pathPts = beamPath ?? [p, node];
        svgParts.push(
          <Polyline key={`link-${s.color}-${i}`} points={pointsAttr(pathPts)} fill="none" stroke={col} strokeWidth={2.5} />
        );
      }
    });
    if (r.receiverReached) {
      // Grow the final link in step with the relay it comes from, instead
      // of snapping straight to the receiver while that relay's own range/
      // beam is still mid-animation -- the last relay placed is the only
      // one that can still be growing by the time this renders.
      const finalParent = r.nodes[r.receiverParent];
      const finalGrowthKey = r.receiverParent > 0 ? `${finalParent.x},${finalParent.y}` : null;
      const finalAnim = finalGrowthKey ? getAnim(finalGrowthKey) : undefined;
      const finalAnimating = !!(finalGrowthKey && finalAnim && isGrowing(finalGrowthKey));

      // Same reasoning as the relay-to-relay link above: prefer the real
      // beam route (even if the plain LOS check already short-circuited past
      // computing one) over a diagonal cut, but only for a node that can
      // actually bounce ('beam' or the dual-mode source/legacy relay).
      const finalCanBounce = finalParent.kind === undefined || finalParent.kind === 'beam';
      const bentPath = r.receiverBouncePath ?? (finalCanBounce ? traceBounceTo(finalParent, r.receiver, level) : null);

      if (bentPath) {
        if (finalAnimating && finalAnim) {
          const total = pathPixelLength(bentPath);
          svgParts.push(
            <AnimatedPolyline
              key={`link-final-${s.color}`}
              points={pointsAttr(bentPath)}
              fill="none"
              stroke={col}
              strokeWidth={2.5}
              strokeDasharray={`${total} ${total}`}
              strokeDashoffset={finalAnim.interpolate({ inputRange: [0, 1], outputRange: [total, 0] })}
            />
          );
        } else {
          svgParts.push(
            <Polyline key={`link-final-${s.color}`} points={pointsAttr(bentPath)} fill="none" stroke={col} strokeWidth={2.5} />
          );
        }
      } else if (finalAnimating && finalAnim) {
        svgParts.push(
          <AnimatedLine
            key={`link-final-${s.color}`}
            x1={toPx(finalParent.x)}
            y1={toPx(finalParent.y)}
            x2={finalAnim.interpolate({ inputRange: [0, 1], outputRange: [toPx(finalParent.x), toPx(r.receiver.x)] })}
            y2={finalAnim.interpolate({ inputRange: [0, 1], outputRange: [toPx(finalParent.y), toPx(r.receiver.y)] })}
            stroke={col}
            strokeWidth={2.5}
          />
        );
      } else {
        svgParts.push(
          <Line
            key={`link-final-${s.color}`}
            x1={toPx(finalParent.x)}
            y1={toPx(finalParent.y)}
            x2={toPx(r.receiver.x)}
            y2={toPx(r.receiver.y)}
            stroke={col}
            strokeWidth={2.5}
          />
        );
      }
    }
  });
  level.sources.forEach((s) => {
    const col = SIGNAL_COLORS[s.color];
    svgParts.push(<Circle key={`src-${s.color}`} cx={toPx(s.x)} cy={toPx(s.y)} r={11} fill={col} stroke="#fff" strokeWidth={2} />);
    svgParts.push(
      <SvgText key={`src-label-${s.color}`} x={toPx(s.x)} y={toPx(s.y) + 4} fontSize={10} fontWeight="700" textAnchor="middle" fill="#0a0c10">
        S
      </SvgText>
    );
  });
  level.receivers.forEach((rec) => {
    const reached = !!results[rec.color]?.receiverReached;
    const col = SIGNAL_COLORS[rec.color];
    const mutedCol = SIGNAL_COLORS_MUTED[rec.color];
    const bounce = getBounceAnim(rec.color);
    svgParts.push(
      <AnimatedCircle
        key={`rec-${rec.color}`}
        cx={toPx(rec.x)}
        cy={toPx(rec.y)}
        r={bounce ? Animated.multiply(bounce, 11) : 11}
        fill="none"
        stroke={reached ? col : mutedCol}
        strokeWidth={reached ? 3 : 2}
        strokeDasharray={reached ? undefined : '3,3'}
      />
    );
    svgParts.push(
      <AnimatedCircle
        key={`rec-dot-${rec.color}`}
        cx={toPx(rec.x)}
        cy={toPx(rec.y)}
        r={bounce ? Animated.multiply(bounce, 3.5) : 3.5}
        fill={reached ? col : mutedCol}
      />
    );
  });
  relays.forEach((rl, idx) => {
    const col = SIGNAL_COLORS[rl.color];
    const isJam = jammed.has(idx);
    svgParts.push(
      <Circle
        key={`relay-${idx}`}
        cx={toPx(rl.x)}
        cy={toPx(rl.y)}
        r={7.5}
        fill={isJam ? colors.warn : rl.locked ? colors.gold : col}
        stroke={rl.locked ? colors.gold : '#fff'}
        strokeWidth={rl.locked ? 2.5 : 1.5}
      />
    );
    if (isJam) {
      svgParts.push(
        <SvgText key={`relay-x-${idx}`} x={toPx(rl.x)} y={toPx(rl.y) + 4} fontSize={10} fontWeight="700" textAnchor="middle" fill="#0a0c10">
          ✕
        </SvgText>
      );
    } else if (rl.kind === 'beam') {
      // A small cross overlay distinguishes a directional "beam" relay from
      // the plain omnidirectional "circle" dot -- purely cosmetic, the
      // actual reach rule lives in canReach's kind dispatch.
      const cx = toPx(rl.x);
      const cy = toPx(rl.y);
      const arm = 4;
      svgParts.push(
        <Line key={`relay-beam-h-${idx}`} x1={cx - arm} y1={cy} x2={cx + arm} y2={cy} stroke="#0a0c10" strokeWidth={1.5} strokeLinecap="round" />
      );
      svgParts.push(
        <Line key={`relay-beam-v-${idx}`} x1={cx} y1={cy - arm} x2={cx} y2={cy + arm} stroke="#0a0c10" strokeWidth={1.5} strokeLinecap="round" />
      );
    }
  });

  return (
    <View style={[styles.wrap, { width: W, height: H }]}>
      <View style={{ width: W, height: H }}>{cells}</View>
      {/* Wrapped in a plain View with pointerEvents="none": react-native-svg's
          <Svg> is a custom native component and doesn't reliably forward a
          pointerEvents prop the way a regular RN View does, so touches were
          being swallowed by this overlay instead of reaching the cells below. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          {mirrors}
          {svgParts}
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center', marginVertical: 8, borderRadius: 10, overflow: 'hidden' },
  cell: {
    position: 'absolute',
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.bg,
  },
  cellWall: { backgroundColor: '#040507' },
  cellMirror: { backgroundColor: colors.surface3 },
});
