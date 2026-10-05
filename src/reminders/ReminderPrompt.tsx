import React, { useEffect } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { fonts, radii } from '../theme/tokens';
import { createThemedStyles } from '../theme/createThemedStyles';
import { useTheme } from '../theme/ThemeProvider';
import { useDailyReminders } from './DailyRemindersProvider';

const BELL_SIZE = 88;

/**
 * One-time "Keep your streak alive?" ask, shown where the player lands right
 * after their first daily solve (Library or the game's hub) -- never cold at
 * launch, and only then does the OS permission prompt follow, so the single
 * shot iOS allows is spent on someone who already said yes.
 *
 * Plain absolutely-positioned overlay, not React Native's <Modal> -- same
 * reasoning as WinOverlay / DailyGiftModal. `suppressed` lets a screen hold
 * it back while another overlay (e.g. the daily hint gift) is up.
 */
export default function ReminderPrompt({ suppressed = false }: { suppressed?: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { t } = useTranslation('common');
  const { promptVisible, acceptPrompt, dismissPrompt } = useDailyReminders();
  const visible = promptVisible && !suppressed;
  const pop = useSharedValue(0);
  const ring = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    pop.value = 0;
    ring.value = 0;
    pop.value = withSpring(1, { duration: 350, dampingRatio: 0.7 });
    // A couple of short bell rings, then rest.
    ring.value = withDelay(
      250,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 90, easing: Easing.out(Easing.ease) }),
          withTiming(-1, { duration: 140, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 90, easing: Easing.in(Easing.ease) })
        ),
        2
      )
    );
  }, [visible, pop, ring]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: pop.value,
    transform: [{ scale: interpolate(pop.value, [0, 1], [0.7, 1]) }],
  }));
  const bellStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${ring.value * 14}deg` }] }));

  if (!visible) return null;

  return (
    <View style={styles.backdrop} pointerEvents="box-none">
      <Animated.View style={[styles.card, cardStyle]}>
        <Animated.View style={[styles.bellCircle, bellStyle]}>
          <Ionicons name="notifications" size={42} color={colors.warn} />
        </Animated.View>
        <Text style={styles.title}>{t('reminders.promptTitle')}</Text>
        <Text style={styles.message}>{t('reminders.promptBody')}</Text>
        <TouchableOpacity style={styles.button} onPress={acceptPrompt} activeOpacity={0.85}>
          <Text style={styles.buttonText}>{t('reminders.promptAccept')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={dismissPrompt} activeOpacity={0.7}>
          <Text style={styles.secondaryButtonText}>{t('reminders.promptDecline')}</Text>
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
    paddingTop: 24,
    paddingBottom: 18,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '80%',
  },
  bellCircle: {
    width: BELL_SIZE,
    height: BELL_SIZE,
    borderRadius: BELL_SIZE / 2,
    backgroundColor: colors.surface2,
    borderWidth: 2,
    borderColor: colors.warn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: fonts.display, fontWeight: '700', fontSize: 19, color: colors.text, marginTop: 16, marginBottom: 6, textAlign: 'center' },
  message: { fontSize: 13, color: colors.textDim, marginBottom: 20, textAlign: 'center', lineHeight: 18 },
  button: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 18, alignSelf: 'stretch', alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  secondaryButton: { alignSelf: 'stretch', alignItems: 'center', paddingTop: 12, paddingBottom: 2 },
  secondaryButtonText: { color: colors.textDim, fontWeight: '600', fontSize: 13.5 },
}));
