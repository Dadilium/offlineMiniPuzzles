import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors, radii } from '../theme/colors';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost';
  hidden?: boolean;
  /** Dims and disables the button while keeping it visible -- for actions
   * that are legal but currently have nothing to act on (e.g. undo with an
   * empty history), as opposed to `hidden` which hides it entirely. */
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Bottom-of-screen action button used by every game's GameScreen: a bordered
 * "primary" button for Hint/Retry/etc, or a plain-text "ghost" button for
 * Skip. `hidden` keeps the layout slot reserved (opacity 0) instead of
 * unmounting, for screens where controls shouldn't reflow on solve. */
export default function GameActionButton({ label, onPress, variant = 'primary', hidden, disabled, style }: Props) {
  return (
    <TouchableOpacity
      style={[variant === 'primary' ? styles.primary : styles.ghost, disabled && styles.disabled, hidden && styles.hidden, style]}
      activeOpacity={0.75}
      onPress={onPress}
      disabled={hidden || disabled}
    >
      <Text style={variant === 'primary' ? styles.primaryText : styles.ghostText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  primary: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingVertical: 13, alignItems: 'center' },
  primaryText: { color: colors.text, fontWeight: '600', fontSize: 14 },
  ghost: { paddingVertical: 8, alignItems: 'center' },
  ghostText: { color: colors.textFaint, fontWeight: '600', fontSize: 12 },
  hidden: { opacity: 0 },
  disabled: { opacity: 0.4 },
});
