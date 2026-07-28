import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors } from '../../../theme/colors';

const COUNT = 16;
const PALETTE = [colors.purple, colors.gold, colors.cyan, colors.pink, colors.success, colors.signalBlue];

/** One-shot confetti burst -- animates on mount, meant to be conditionally
 * rendered only at the moment a level is first cleared (see GameScreen). */
export default function Confetti() {
  const dots = useRef(
    Array.from({ length: COUNT }, (_, i) => {
      const angle = (i / COUNT) * Math.PI * 2 + Math.random() * 0.5;
      return {
        translate: new Animated.Value(0),
        angle,
        dist: 60 + Math.random() * 90,
        rotateTo: Math.random() * 360,
        color: PALETTE[i % PALETTE.length],
        left: 42 + Math.random() * 16,
        top: 32 + Math.random() * 16,
        duration: 900 + Math.random() * 300,
      };
    })
  ).current;

  useEffect(() => {
    const anims = dots.map((d) => Animated.timing(d.translate, { toValue: 1, duration: d.duration, useNativeDriver: true }));
    Animated.stagger(10, anims).start();
  }, [dots]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {dots.map((d, i) => {
        const tx = d.translate.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(d.angle) * d.dist] });
        const ty = d.translate.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(d.angle) * d.dist - 30] });
        const opacity = d.translate.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] });
        const rotate = d.translate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${d.rotateTo}deg`] });
        return (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              {
                left: `${d.left}%`,
                top: `${d.top}%`,
                backgroundColor: d.color,
                opacity,
                transform: [{ translateX: tx }, { translateY: ty }, { rotate }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { position: 'absolute', width: 8, height: 8, borderRadius: 2 },
});
