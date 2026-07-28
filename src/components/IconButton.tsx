import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors } from '../theme/colors';

interface Props {
  glyph: string;
  onPress: () => void;
  accessibilityLabel?: string;
  size?: number;
  glyphSize?: number;
}

/** Small square icon button used in topbars (back / reset / replay-tutorial). */
export default function IconButton({ glyph, onPress, accessibilityLabel, size = 34, glyphSize = 15 }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={accessibilityLabel}
      style={[styles.btn, { width: size, height: size, borderRadius: size * 0.32 }]}
    >
      <Text style={[styles.glyph, { fontSize: glyphSize }]}>{glyph}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { color: colors.text },
});
