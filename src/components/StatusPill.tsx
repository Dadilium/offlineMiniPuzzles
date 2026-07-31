import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { colors, fonts } from '../theme/colors';

interface Props {
  color: string;
  dim?: string;
  children: React.ReactNode;
}

/** Small mono status readout used in every GameScreen's status row (move
 * count, solved count, conflicts, etc). Fades in on mount, so pills that
 * appear conditionally (e.g. a conflict warning) don't just pop in.
 * `dim` renders a trailing de-emphasized segment inline, e.g. "12 moves · par 8". */
export default function StatusPill({ color, dim, children }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [opacity]);

  return (
    <Animated.Text style={[styles.pill, { color, opacity }]}>
      {children}
      {dim ? <Text style={styles.dim}> {dim}</Text> : null}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  pill: { fontSize: 11.5, fontWeight: '600', fontFamily: fonts.mono },
  dim: { color: colors.textDim, fontWeight: '600' },
});
