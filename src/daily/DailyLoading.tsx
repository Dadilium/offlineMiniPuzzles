import React, { useEffect } from 'react';
import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import TopBar from '../components/TopBar';
import { createThemedStyles } from '../theme/createThemedStyles';

/** Shown while today's daily board is still being built -- only visible when
 * the background prebuild (started at launch) hasn't finished yet. Fades in
 * after a short delay so a fast build never flashes it, and keeps a back
 * button so a slow Expert build never traps the player. */
export default function DailyLoading({ accentColor, onBack }: { accentColor: string; onBack: () => void }) {
  const styles = useStyles();
  const { t } = useTranslation('common');
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.12, { duration: 650 }), withTiming(1, { duration: 650 })), -1);
  }, [pulse]);

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }], opacity: 0.55 + (pulse.value - 1) * 3.5 }));

  return (
    <SafeAreaView style={styles.screen}>
      <TopBar onBack={onBack} />
      <Animated.View entering={FadeIn.delay(250).duration(300)} style={styles.content}>
        <Animated.View style={iconStyle}>
          <Ionicons name="calendar" size={36} color={accentColor} />
        </Animated.View>
        <Text style={styles.text}>{t('daily.building')}</Text>
      </Animated.View>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bgDeep },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  text: { fontSize: 14, color: colors.textDim },
}));
