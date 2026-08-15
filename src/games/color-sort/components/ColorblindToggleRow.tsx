import React, { useEffect, useRef } from 'react';
import { Animated, Text, TouchableOpacity, View } from 'react-native';
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
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, { toValue: value ? 1 : 0, useNativeDriver: false, speed: 20, bounciness: 6 }).start();
  }, [value, anim]);

  const knobLeft = anim.interpolate({ inputRange: [0, 1], outputRange: [KNOB_MARGIN, TRACK_WIDTH - KNOB_SIZE - KNOB_MARGIN] });
  const trackColor = anim.interpolate({ inputRange: [0, 1], outputRange: [colors.surface3, accentColor] });

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
      <Animated.View style={[styles.track, { backgroundColor: trackColor }]}>
        <Animated.View style={[styles.knob, { left: knobLeft }]} />
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
