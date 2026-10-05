import React from 'react';
import { Path } from 'react-native-svg';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import type { Vec } from '../types';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Sparkles drop along the first part of the flight, while the arrow is still solid. */
const SPAWN_SPAN = 0.6;
/** How long each sparkle lives, as a fraction of the flight. */
const LIFESPAN = 0.32;
/** Largest sparkle radius, in cells. */
const MAX_RADIUS = 0.34;
/** Sideways scatter off the flight line, in cells. */
const SCATTER = 0.42;

/** Four-point twinkle: each arm curves in through the center. */
function sparkleD(x: number, y: number, radius: number): string {
  'worklet';
  if (radius <= 0.01) return '';
  return `M${x} ${y - radius}Q${x} ${y} ${x + radius} ${y}Q${x} ${y} ${x} ${y + radius}Q${x} ${y} ${x - radius} ${y}Q${x} ${y} ${x} ${y - radius}Z`;
}

interface SparkleProps {
  progress: SharedValue<number>;
  travel: number;
  /** 0-1: where along the flight this sparkle drops off the head. */
  spawnAt: number;
  /** -1..1 sideways offset off the flight line. */
  side: number;
  head: { x: number; y: number };
  dir: Vec;
  cell: number;
  color: string;
}

function Sparkle({ progress, travel, spawnAt, side, head, dir, cell, color }: SparkleProps) {
  const animatedProps = useAnimatedProps(() => {
    const life = (progress.value / travel - spawnAt) / LIFESPAN;
    if (life <= 0 || life >= 1) return { d: '', opacity: 0 };
    const along = spawnAt * travel;
    // Drift a little further off the line as it fades, like a spark thrown clear.
    const drift = side * SCATTER * cell * (0.6 + life * 0.6);
    const x = head.x + dir.dc * along - dir.dr * drift;
    const y = head.y + dir.dr * along + dir.dc * drift;
    const pop = Math.sin(Math.PI * life);
    return { d: sparkleD(x, y, MAX_RADIUS * cell * pop), opacity: pop };
  });
  return <AnimatedPath fill={color} animatedProps={animatedProps} />;
}

interface Props {
  progress: SharedValue<number>;
  travel: number;
  count: number;
  head: { x: number; y: number };
  dir: Vec;
  cell: number;
  color: string;
}

/**
 * Combo-streak trail for an exiting arrow: twinkles shed from the head as it
 * flies, alternating sides of the line. Driven entirely by the arrow's own
 * `progress`, so it costs no extra timers and ends with the flight.
 */
export default function ComboSparkles({ progress, travel, count, head, dir, cell, color }: Props) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <Sparkle
          key={i}
          progress={progress}
          travel={travel}
          spawnAt={(i / count) * SPAWN_SPAN}
          // Alternate sides, varying the distance so the trail doesn't read as a zipper.
          side={(i % 2 === 0 ? 1 : -1) * (0.5 + ((i * 7) % 5) / 8)}
          head={head}
          dir={dir}
          cell={cell}
          color={color}
        />
      ))}
    </>
  );
}
