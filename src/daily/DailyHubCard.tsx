import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { playSound } from '../sound/soundEngine';
import { useTranslation } from 'react-i18next';
import type { DifficultyTier } from '../state/difficultyTiers';
import { fonts, radii } from '../theme/tokens';
import { createThemedStyles } from '../theme/createThemedStyles';
import { useTheme } from '../theme/ThemeProvider';
import { formatDailyDate } from './dailyDate';
import { formatDuration } from './shareText';

export interface DailyHubCardProps {
  dayNumber: number;
  tier: DifficultyTier;
  /** This game's current daily streak. */
  streak: number;
  status: 'new' | 'started' | 'solved';
  elapsedMs: number;
  onPlay: () => void;
  onShare: () => void;
}

interface Props extends DailyHubCardProps {
  accentColor: string;
}

/** The game hub's "Daily #142 · Hard" card: today's puzzle, this game's
 * streak, and one action -- Play / Continue, or Share once solved. */
export default function DailyHubCard({ dayNumber, tier, streak, status, elapsedMs, onPlay, onShare, accentColor }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { t } = useTranslation('common');
  const solved = status === 'solved';

  function handlePress() {
    void Haptics.selectionAsync();
    playSound('tap');
    if (solved) onShare();
    else onPlay();
  }

  const actionLabel = solved ? t('daily.share') : status === 'started' ? t('actions.resume') : t('actions.play');
  const subtitle = solved
    ? t('daily.solvedIn', { time: formatDuration(elapsedMs) })
    : streak > 0
      ? t('daily.keepStreak')
      : t('daily.newEveryDay');

  return (
    <Animated.View entering={FadeInDown.duration(320).springify()} style={styles.wrap}>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [styles.card, { borderColor: `${accentColor}66` }, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`${t('daily.gameTitle', { date: formatDailyDate(t, dayNumber), tier: t(`difficulty.tiers.${tier}`) })}. ${actionLabel}`}
      >
        <View style={[styles.iconWrap, { backgroundColor: `${accentColor}26` }]}>
          <Ionicons name="calendar" size={20} color={accentColor} />
          {solved && (
            <Animated.View entering={ZoomIn.springify()} style={[styles.check, { backgroundColor: colors.success }]}>
              <Ionicons name="checkmark" size={11} color="#fff" />
            </Animated.View>
          )}
        </View>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.eyebrow}>{t('daily.eyebrow', { date: formatDailyDate(t, dayNumber) })}</Text>
            <Text style={[styles.tier, { color: accentColor }]}>{t(`difficulty.tiers.${tier}`)}</Text>
            {streak > 0 && <Text style={styles.streak}>🔥 {streak}</Text>}
          </View>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>

        <View style={[styles.action, { backgroundColor: solved ? colors.surface3 : accentColor }]}>
          {solved && <Ionicons name="share-outline" size={14} color={colors.text} />}
          <Text style={[styles.actionText, { color: solved ? colors.text : '#fff' }]}>{actionLabel}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  wrap: { marginHorizontal: 20, marginBottom: 14 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderRadius: radii.lg,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  iconWrap: { width: 40, height: 40, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  check: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 17,
    height: 17,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  body: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  eyebrow: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textDim },
  tier: { fontFamily: fonts.display, fontSize: 13, fontWeight: '700' },
  streak: { fontSize: 12, fontWeight: '600', color: colors.text },
  subtitle: { fontSize: 12.5, color: colors.textDim, marginTop: 3 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radii.sm, paddingVertical: 8, paddingHorizontal: 13 },
  actionText: { fontWeight: '600', fontSize: 13 },
}));
