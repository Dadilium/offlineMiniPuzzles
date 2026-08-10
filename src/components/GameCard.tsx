import React, { useEffect, useRef } from 'react';
import type { ComponentType } from 'react';
import { Animated, Dimensions, Text, TouchableOpacity, View } from 'react-native';
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
}

/** Rectangular Library grid tile: tinted art zone on top, name + tag below. */
export default function GameCard({ title, tag, color, ArtComponent, onPress, index = 0, locked = false }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const resolvedColor = color ?? colors.signalBlue;
  const mount = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(mount, {
      toValue: 1,
      duration: 320,
      delay: index * 40,
      useNativeDriver: true,
    }).start();
  }, [mount, index]);

  const animateTo = (toValue: number) => {
    Animated.spring(press, { toValue, useNativeDriver: true, speed: 24, bounciness: 6 }).start();
  };

  return (
    <Animated.View
      style={{
        opacity: mount,
        transform: [{ translateY: mount.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }, { scale: press }],
      }}
    >
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
  body: { padding: 12 },
  name: { fontFamily: fonts.display, fontWeight: '700', fontSize: 15, color: colors.text },
  nameLocked: { color: colors.textDim },
  tag: { fontSize: 11.5, color: colors.textDim, marginTop: 2 },
}));
