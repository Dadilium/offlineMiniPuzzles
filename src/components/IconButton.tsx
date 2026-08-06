import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

interface Props {
  /** Ionicons glyph name (e.g. 'chevron-back', 'refresh-outline'). */
  name: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel?: string;
  size?: number;
  iconSize?: number;
}

/** Small square icon button used in topbars (back / reset / replay-tutorial / settings).
 * Always an Ionicons vector glyph -- text-character glyphs (e.g. '⟲') render
 * inconsistently across platforms since they fall back to whatever the OS's
 * default/emoji font happens to support. */
export default function IconButton({ name, onPress, accessibilityLabel, size = 40, iconSize = 19 }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={accessibilityLabel}
      style={[styles.btn, { width: size, height: size, borderRadius: size * 0.32 }]}
    >
      <Ionicons name={name} size={iconSize} color={colors.text} />
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
});
