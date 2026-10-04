import React, { useEffect, useMemo } from 'react';
import { Path } from 'react-native-svg';
import Animated, { Easing, interpolate, runOnJS, useAnimatedProps, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { headTriangleD, launchTrackD, type ArrowGeometry } from './arrowGeometry';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** How far into the blocker's cell the tip pushes before bouncing back, in cells. */
const BUMP_OVERSHOOT = 0.14;

export interface Motion {
  kind: 'exit' | 'bump';
  /** Empty cells straight ahead of the head before the edge / the blocker. */
  clearCells: number;
}

interface Props {
  geometry: ArrowGeometry;
  motion: Motion;
  cell: number;
  strokeWidth: number;
  color: string;
  /** Fires the instant a bumping arrow touches its blocker -- heart + haptic land here. */
  onImpact?: () => void;
  /** Fires once the arrow has fully left the board, or settled back home after a bump. */
  onDone: () => void;
}

function exitDuration(cellsTravelled: number): number {
  'worklet';
  return Math.min(720, Math.max(280, 200 + cellsTravelled * 26));
}

/**
 * A launched arrow, sliding like a snake: its body is a dash exactly
 * `bodyLength` long riding a track made of its own body plus a straight
 * run past the head. Moving the dash offset by `progress` pulls the whole
 * arrow `progress` pt along that track -- the tail follows every bend the
 * head took -- while the head triangle is redrawn at the dash's front.
 */
function MovingArrow({ geometry, motion, cell, strokeWidth, color, onImpact, onDone }: Props) {
  const progress = useSharedValue(0);
  const { bodyLength, head, dir } = geometry;

  // Exit: far enough that the tail clears the board edge, plus the tip.
  // Bump: just far enough for the tip to touch the blocker's line.
  const travel = motion.kind === 'exit' ? (motion.clearCells + 1) * cell + bodyLength : (motion.clearCells + BUMP_OVERSHOOT) * cell;
  const trackD = useMemo(() => launchTrackD(geometry, travel + cell), [geometry, travel, cell]);

  useEffect(() => {
    if (motion.kind === 'exit') {
      progress.value = withTiming(travel, { duration: exitDuration(travel / cell), easing: Easing.in(Easing.quad) }, (finished) => {
        if (finished) runOnJS(onDone)();
      });
      return;
    }
    progress.value = withSequence(
      withTiming(travel, { duration: Math.min(300, 90 + motion.clearCells * 30), easing: Easing.in(Easing.quad) }, (finished) => {
        if (finished && onImpact) runOnJS(onImpact)();
      }),
      withSpring(0, { duration: 420, dampingRatio: 0.45 }, (finished) => {
        if (finished) runOnJS(onDone)();
      })
    );
    // One animation per mount: a new launch of this arrow is a new mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fadeFrom = motion.kind === 'exit' ? travel * 0.55 : Number.MAX_SAFE_INTEGER;

  const bodyProps = useAnimatedProps(() => ({
    strokeDashoffset: -progress.value,
    opacity: motion.kind === 'exit' ? interpolate(progress.value, [fadeFrom, travel], [1, 0], 'clamp') : 1,
  }));

  const headProps = useAnimatedProps(() => ({
    d: headTriangleD(head.x + dir.dc * progress.value, head.y + dir.dr * progress.value, dir.dc, dir.dr, cell),
    opacity: motion.kind === 'exit' ? interpolate(progress.value, [fadeFrom, travel], [1, 0], 'clamp') : 1,
  }));

  return (
    <>
      <AnimatedPath
        d={trackD}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeDasharray={[bodyLength, bodyLength + travel + cell * 4]}
        animatedProps={bodyProps}
      />
      <AnimatedPath d={geometry.headD} fill={color} animatedProps={headProps} />
    </>
  );
}

export default React.memo(MovingArrow);
