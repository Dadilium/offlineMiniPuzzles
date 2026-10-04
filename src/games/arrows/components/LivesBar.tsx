import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/ThemeProvider';
import { createThemedStyles } from '../../../theme/createThemedStyles';

const HEART_SIZE = 26;

/** One heart: pops and shakes as it breaks, springs back in when refilled. */
function Heart({ filled }: { filled: boolean }) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const rotate = useSharedValue(0);
  const wasFilled = useRef(filled);

  useEffect(() => {
    if (wasFilled.current && !filled) {
      scale.value = withSequence(withTiming(1.45, { duration: 110 }), withSpring(1, { duration: 360, dampingRatio: 0.5 }));
      rotate.value = withSequence(
        withTiming(-14, { duration: 60 }),
        withTiming(12, { duration: 70 }),
        withTiming(-8, { duration: 70 }),
        withTiming(0, { duration: 70 })
      );
    } else if (!wasFilled.current && filled) {
      scale.value = 0.4;
      scale.value = withSpring(1, { duration: 380, dampingRatio: 0.55 });
    }
    wasFilled.current = filled;
  }, [filled, scale, rotate]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }, { rotate: `${rotate.value}deg` }] }));

  return (
    <Animated.View style={style}>
      <Ionicons name={filled ? 'heart' : 'heart-outline'} size={HEART_SIZE} color={filled ? colors.signalRed : colors.textFaint} />
    </Animated.View>
  );
}

export default function LivesBar({ livesLeft, maxLives }: { livesLeft: number; maxLives: number }) {
  const styles = useStyles();
  const { t } = useTranslation('arrows');
  return (
    <View style={styles.row} accessibilityRole="text" accessibilityLabel={t('game.livesA11y', { count: livesLeft })}>
      {Array.from({ length: maxLives }, (_, i) => (
        <Heart key={i} filled={i < livesLeft} />
      ))}
    </View>
  );
}

const useStyles = createThemedStyles(() => ({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 12, paddingTop: 4, paddingBottom: 8 },
}));
