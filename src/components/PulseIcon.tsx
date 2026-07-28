import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';

/** The little pulsing radar-dot icon used for the Relay game card / hub hero. */
export default function PulseIcon({ size = 58, dotColor = colors.signalBlue }: { size?: number; dotColor?: string }) {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const makeLoop = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1, duration: 2600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        ])
      );
    const l1 = makeLoop(ring1, 0);
    const l2 = makeLoop(ring2, 900);
    l1.start();
    l2.start();
    return () => {
      l1.stop();
      l2.stop();
    };
  }, [ring1, ring2]);

  const ringSize = size * 0.6;
  const ringStyle = (val: Animated.Value) => ({
    width: ringSize,
    height: ringSize,
    borderRadius: ringSize / 2,
    borderWidth: 1.5,
    borderColor: dotColor,
    borderStyle: 'dashed' as const,
    position: 'absolute' as const,
    opacity: val.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0.65, 0, 0] }),
    transform: [
      {
        scale: val.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1.15] }),
      },
    ],
  });

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Animated.View style={ringStyle(ring1)} />
      <Animated.View style={ringStyle(ring2)} />
      <View style={[styles.dot, { backgroundColor: dotColor, shadowColor: dotColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  dot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    shadowOpacity: 0.7,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
});
