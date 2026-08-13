import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts, radii } from '../theme/tokens';
import { createThemedStyles } from '../theme/createThemedStyles';
import { useTheme } from '../theme/ThemeProvider';

const BULB_SIZE = 96;
const BADGE_SIZE = 36;

interface Props {
  visible: boolean;
  amount: number;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
}

// Plain absolutely-positioned overlay, not React Native's <Modal> -- same
// reasoning as WinOverlay: navigating away while a native Modal is presented
// is a known iOS crash.
export default function DailyGiftModal({ visible, amount, title, message, confirmLabel, onConfirm }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const pop = useRef(new Animated.Value(0)).current;
  const wobble = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    pop.setValue(0);
    wobble.setValue(0);
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 10 }).start();
    Animated.sequence([
      Animated.delay(150),
      Animated.timing(wobble, { toValue: 1, duration: 200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.spring(wobble, { toValue: 0, useNativeDriver: true, speed: 10, bounciness: 14 }),
    ]).start();
  }, [visible, pop, wobble]);

  if (!visible) return null;

  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  const tilt = wobble.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-10deg'] });

  return (
    <View style={styles.backdrop} pointerEvents="box-none">
      <Animated.View style={[styles.card, { opacity: pop, transform: [{ scale }] }]}>
        <View style={styles.bulbStage}>
          <Animated.View style={[styles.bulbCircle, { transform: [{ rotate: tilt }] }]}>
            <Ionicons name="bulb" size={48} color={colors.gold} />
          </Animated.View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>+{amount}</Text>
          </View>
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        <TouchableOpacity style={styles.button} onPress={onConfirm} activeOpacity={0.85}>
          <Text style={styles.buttonText}>{confirmLabel}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(5,6,10,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '80%',
  },
  bulbStage: { width: BULB_SIZE + BADGE_SIZE / 2, height: BULB_SIZE, alignItems: 'center', justifyContent: 'center' },
  bulbCircle: {
    width: BULB_SIZE,
    height: BULB_SIZE,
    borderRadius: BULB_SIZE / 2,
    backgroundColor: colors.surface2,
    borderWidth: 2,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: colors.gold,
    borderWidth: 3,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: colors.bgDeep, fontWeight: '700', fontSize: 14, fontFamily: fonts.display },
  title: { fontFamily: fonts.display, fontWeight: '700', fontSize: 19, color: colors.text, marginTop: 16, marginBottom: 6, textAlign: 'center' },
  message: { fontSize: 13, color: colors.textDim, marginBottom: 20, textAlign: 'center', lineHeight: 18 },
  button: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 18, alignSelf: 'stretch', alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
}));
