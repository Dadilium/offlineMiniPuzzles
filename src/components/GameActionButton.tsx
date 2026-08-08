import React, { useRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Animated, StyleSheet, Text, TouchableWithoutFeedback, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

const SIZE = 56;
const ICON_SIZE = 22;
const BADGE_SIZE = 18;

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  caption: string;
  accessibilityLabel: string;
  onPress: () => void;
  /** A number renders a small count pill; `'ad'` renders a video-camera icon
   * for actions gated behind a rewarded ad; omit for no badge. */
  badge?: number | 'ad';
  hidden?: boolean;
  /** Dims and disables the button while keeping it visible -- for actions
   * that are legal but currently have nothing to act on (e.g. undo with an
   * empty history), as opposed to `hidden` which hides it entirely. */
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Round bottom-of-screen action button used by every game's GameScreen:
 * an icon circle with a short caption below and an optional badge (a count,
 * or an ad indicator) in the corner. `hidden` keeps the layout slot reserved
 * (opacity 0) instead of unmounting, for screens where controls shouldn't
 * reflow on solve. */
export default function GameActionButton({ icon, caption, accessibilityLabel, onPress, badge, hidden, disabled, style }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const interactive = !hidden && !disabled;

  function animateTo(value: number) {
    Animated.spring(scale, { toValue: value, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
  }

  return (
    <TouchableWithoutFeedback
      accessibilityLabel={accessibilityLabel}
      onPress={interactive ? onPress : undefined}
      onPressIn={interactive ? () => animateTo(0.92) : undefined}
      onPressOut={interactive ? () => animateTo(1) : undefined}
      disabled={!interactive}
    >
      <View style={[styles.wrap, hidden && styles.hidden, disabled && styles.disabled, style]}>
        <Animated.View style={[styles.circle, { transform: [{ scale }] }]}>
          <Ionicons name={icon} size={ICON_SIZE} color={colors.text} />
          {badge !== undefined && (
            <View style={[styles.badge, badge === 'ad' && styles.badgeAd]}>
              {badge === 'ad' ? (
                <Ionicons name="videocam" size={10} color={colors.bgDeep} />
              ) : (
                <Text style={styles.badgeText}>{badge}</Text>
              )}
            </View>
          )}
        </Animated.View>
        <Text style={styles.caption}>{caption}</Text>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', width: SIZE + 12 },
  hidden: { opacity: 0 },
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  caption: { marginTop: 6, color: colors.textDim, fontWeight: '600', fontSize: 11, textAlign: 'center' },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.bgDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeAd: { backgroundColor: colors.gold },
  badgeText: { color: colors.text, fontWeight: '700', fontSize: 10 },
});
