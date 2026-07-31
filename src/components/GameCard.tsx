import React, { useEffect, useRef } from 'react';
import type { ComponentType } from 'react';
import { Animated, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts, radii } from '../theme/colors';

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
export default function GameCard({ title, tag, color = colors.signalBlue, ArtComponent, onPress, index = 0, locked = false }: Props) {
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
        <View style={[styles.art, { backgroundColor: locked ? colors.surface3 : `${color}1a` }]}>
          {ArtComponent && !locked && <ArtComponent size={ART_HEIGHT * 0.52} color={color} />}
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

const styles = StyleSheet.create({
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
  },
  body: { padding: 12 },
  name: { fontFamily: fonts.display, fontWeight: '700', fontSize: 15, color: colors.text },
  nameLocked: { color: colors.textDim },
  tag: { fontSize: 11.5, color: colors.textDim, marginTop: 2 },
});
