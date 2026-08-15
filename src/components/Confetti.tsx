import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

const COUNT = 16;
// Matches the original `Animated.stagger(10, ...)` spacing between dots.
const STAGGER_MS = 10;

interface Props {
  palette: string[];
}

interface DotConfig {
  angle: number;
  dist: number;
  rotateTo: number;
  color: string;
  left: number;
  top: number;
  duration: number;
}

function makeDotConfigs(palette: string[]): DotConfig[] {
  return Array.from({ length: COUNT }, (_, i) => {
    const angle = (i / COUNT) * Math.PI * 2 + Math.random() * 0.5;
    return {
      angle,
      dist: 60 + Math.random() * 90,
      rotateTo: Math.random() * 360,
      color: palette[i % palette.length],
      left: 42 + Math.random() * 16,
      top: 32 + Math.random() * 16,
      duration: 900 + Math.random() * 300,
    };
  });
}

/** One confetti dot -- a shared value can't be created in a loop inside the
 * parent (that would call `useSharedValue` a variable number of times), so
 * each dot owns its own hook via this subcomponent, same split as Shikaku's
 * per-rect/per-clue pieces. Animates its own outward translate/rotate/fade
 * on mount, delayed by `index * STAGGER_MS` to reproduce the original stagger. */
function ConfettiDot({ config, index }: { config: DotConfig; index: number }) {
  const translate = useSharedValue(0);

  useEffect(() => {
    translate.value = withDelay(index * STAGGER_MS, withTiming(1, { duration: config.duration }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translate.value, [0, 0.8, 1], [1, 1, 0]),
    transform: [
      { translateX: interpolate(translate.value, [0, 1], [0, Math.cos(config.angle) * config.dist]) },
      { translateY: interpolate(translate.value, [0, 1], [0, Math.sin(config.angle) * config.dist - 30]) },
      { rotate: `${interpolate(translate.value, [0, 1], [0, config.rotateTo])}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.dot,
        { left: `${config.left}%`, top: `${config.top}%`, backgroundColor: config.color },
        animatedStyle,
      ]}
    />
  );
}

/** One-shot confetti burst -- animates on mount, meant to be conditionally
 * rendered only at the moment a level is first solved (see WinOverlay). */
export default function Confetti({ palette }: Props) {
  const configs = useRef(makeDotConfigs(palette)).current;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {configs.map((config, i) => (
        <ConfettiDot key={i} config={config} index={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { position: 'absolute', width: 8, height: 8, borderRadius: 2 },
});
