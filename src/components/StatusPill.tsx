import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { colors, fonts } from '../theme/colors';

interface Props {
  color: string;
  dim?: string;
  children: React.ReactNode;
}

/** Small mono status readout used in every GameScreen's status row (move
 * count, solved count, conflicts, etc). `dim` renders a trailing de-emphasized
 * segment inline, e.g. "12 moves · par 8". */
export default function StatusPill({ color, dim, children }: Props) {
  return (
    <Text style={[styles.pill, { color }]}>
      {children}
      {dim ? <Text style={styles.dim}> {dim}</Text> : null}
    </Text>
  );
}

const styles = StyleSheet.create({
  pill: { fontSize: 11.5, fontWeight: '600', fontFamily: fonts.mono },
  dim: { color: colors.textDim, fontWeight: '600' },
});
