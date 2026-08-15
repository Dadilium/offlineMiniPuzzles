import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createThemedStyles } from '../theme/createThemedStyles';
import { useTheme } from '../theme/ThemeProvider';

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
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={accessibilityLabel}
      // At the default 40px this sits below Apple/Google's ~44-48pt minimum
      // touch target. Generous top/bottom since nothing else sits directly
      // above/below it in a topbar; tighter left/right since TopBar's `right`
      // slot can hold two of these 10px apart (see TopBar.tsx) -- 4px here
      // keeps their expanded hit areas from meeting in the middle.
      hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
      style={[styles.btn, { width: size, height: size, borderRadius: size * 0.32 }]}
    >
      <Ionicons name={name} size={iconSize} color={colors.text} />
    </TouchableOpacity>
  );
}

const useStyles = createThemedStyles((colors) => ({
  btn: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
