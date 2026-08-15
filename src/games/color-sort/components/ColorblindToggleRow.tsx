import React, { useEffect } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Animated, { interpolate, interpolateColor, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { fonts, radii } from '../../../theme/tokens';
import { createThemedStyles } from '../../../theme/createThemedStyles';
import { useTheme } from '../../../theme/ThemeProvider';

const TRACK_WIDTH = 46;
const TRACK_HEIGHT = 26;
const KNOB_SIZE = 20;
const KNOB_MARGIN = 3;

interface Props {
  label: string;
  sub: string;
  value: boolean;
  onChange: (value: boolean) => void;
  accentColor: string;
}

/** Small pill switch matching this app's existing toggle style (no native
 * `Switch` is used anywhere -- see the theme/language pills in Settings) --
 * knob slides with a spring, track tints between off/on colors. */
export default function ColorblindToggleRow({ label, sub, value, onChange, accentColor }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const anim = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    anim.value = withSpring(value ? 1 : 0, { duration: 200, dampingRatio: 0.8 });
  }, [value, anim]);

  const knobStyle = useAnimatedStyle(() => ({
    left: interpolate(anim.value, [0, 1], [KNOB_MARGIN, TRACK_WIDTH - KNOB_SIZE - KNOB_MARGIN]),
  }));
  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(anim.value, [0, 1], [colors.surface3, accentColor]),
  }));

  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.75}
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
    >
      <View style={styles.textWrap}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>
      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View style={[styles.knob, knobStyle]} />
      </Animated.View>
    </TouchableOpacity>
  );
}

const useStyles = createThemedStyles((colors) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    marginBottom: 14,
    gap: 12,
  },
  textWrap: { flex: 1, minWidth: 0 },
  label: { fontFamily: fonts.display, fontWeight: '600', fontSize: 14, color: colors.text },
  sub: { fontSize: 12, color: colors.textDim, marginTop: 2 },
  track: { width: TRACK_WIDTH, height: TRACK_HEIGHT, borderRadius: TRACK_HEIGHT / 2, justifyContent: 'center' },
  knob: {
    position: 'absolute',
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    backgroundColor: '#fff',
  },
}));
