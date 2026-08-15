import React, { useEffect } from 'react';
import type { ComponentType } from 'react';
import { Dimensions, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { fonts, radii } from '../theme/tokens';
import { createThemedStyles } from '../theme/createThemedStyles';
import { useTheme } from '../theme/ThemeProvider';
import { darkPalette } from '../theme/palettes';

const screenWidth = Dimensions.get('window').width;
const GRID_GUTTER = 20;
const GRID_GAP = 14;
export const CARD_WIDTH = (screenWidth - GRID_GUTTER * 2 - GRID_GAP) / 2;
const ART_HEIGHT = CARD_WIDTH * 0.82;

interface Props {
  title: string;
  tag: string;
  color?: string;
  ArtComponent?: ComponentType<{ size: number; color: string }>;
  onPress?: () => void;
  index?: number;
  locked?: boolean;
  isNew?: boolean;
}

/** Rectangular Library grid tile: tinted art zone on top, name + tag below. */
export default function GameCard({
  title,
  tag,
  color,
  ArtComponent,
  onPress,
  index = 0,
  locked = false,
  isNew = false,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles();
  const resolvedColor = color ?? colors.signalBlue;
  const mount = useSharedValue(0);
  const press = useSharedValue(1);
  const pulse = useSharedValue(0);

  useEffect(() => {
    mount.value = withDelay(index * 40, withTiming(1, { duration: 320 }));
  }, [mount, index]);

  useEffect(() => {
    if (!isNew || locked) return undefined;
    pulse.value = withRepeat(withSequence(withTiming(1, { duration: 900 }), withTiming(0, { duration: 900 })), -1, false);
    return () => cancelAnimation(pulse);
  }, [isNew, locked, pulse]);

  const animateTo = (toValue: number) => {
    press.value = withSpring(toValue, { duration: 200, dampingRatio: 0.8 });
  };

  const cardMountStyle = useAnimatedStyle(() => ({
    opacity: mount.value,
    transform: [{ translateY: interpolate(mount.value, [0, 1], [12, 0]) }, { scale: press.value }],
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: '32deg' }, { scale: interpolate(pulse.value, [0, 1], [1, 1.08]) }],
    shadowOpacity: interpolate(pulse.value, [0, 1], [0.35, 0.85]),
  }));

  return (
    <Animated.View style={cardMountStyle}>
      <TouchableOpacity
        style={[styles.card, locked && styles.cardLocked]}
        activeOpacity={0.9}
        disabled={locked || !onPress}
        onPress={onPress}
        onPressIn={() => !locked && animateTo(0.96)}
        onPressOut={() => !locked && animateTo(1)}
      >
        <View style={[styles.art, { backgroundColor: locked ? colors.surface3 : darkPalette.surface3 }]}>
          {!locked && <View style={[styles.artTint, { backgroundColor: `${resolvedColor}59` }]} />}
          {ArtComponent && !locked && <ArtComponent size={ART_HEIGHT * 0.52} color={resolvedColor} />}
        </View>
        {isNew && !locked && (
          // Sits outside `art` so it's clipped by the card's own rounded
          // corner + overflow:hidden -- the classic ribbon-in-a-corner trick,
          // no extra clipping logic needed.
          <Animated.View
            style={[
              styles.newBadge,
              {
                backgroundColor: colors.gold,
                shadowColor: colors.gold,
              },
              badgeStyle,
            ]}
          >
            <Text style={styles.newBadgeText}>{t('library.newBadge')}</Text>
          </Animated.View>
        )}
        <View style={styles.body}>
          <Text style={[styles.name, locked && styles.nameLocked]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.tag} numberOfLines={1}>
            {tag}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  card: {
    width: CARD_WIDTH,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    overflow: 'hidden',
  },
  cardLocked: {
    borderStyle: 'dashed',
    borderWidth: 1.5,
    opacity: 0.55,
  },
  art: {
    width: '100%',
    height: ART_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  // The tint blends against a fixed dark base (set on `art` above) rather
  // than the active theme's surface color, so a game's accent tint reads
  // the same in light mode as it always has in dark mode.
  artTint: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  // minWidth (not a fixed width) so a short label like "NEW" still gets
  // padded out to the same ribbon length a longer one (French "NOUVEAU")
  // naturally reaches -- otherwise a short label sits mostly past the
  // card's edge and gets clipped through the middle instead of along its
  // diagonal fold.
  newBadge: {
    position: 'absolute',
    top: 14,
    right: -34,
    minWidth: 120,
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  newBadgeText: {
    fontFamily: fonts.mono,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#12141c',
    textAlign: 'center',
  },
  body: { padding: 12 },
  name: { fontFamily: fonts.display, fontWeight: '700', fontSize: 15, color: colors.text },
  nameLocked: { color: colors.textDim },
  tag: { fontSize: 11.5, color: colors.textDim, marginTop: 2 },
}));
