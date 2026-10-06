import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInRight, ZoomIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { playSound } from '../sound/soundEngine';
import { useTranslation } from 'react-i18next';
import type { GameModule } from '../games/types';
import { translateDynamic } from '../i18n/dynamicKey';
import { fonts, radii } from '../theme/tokens';
import { createThemedStyles } from '../theme/createThemedStyles';
import { useTheme } from '../theme/ThemeProvider';
import { tierForDayNumber } from './calendar';
import { formatDailyDate } from './dailyDate';
import { useDailyResults } from './DailyResultsProvider';

const CHIP_SIZE = 64;
const ART_SIZE = 34;

interface Props {
  games: GameModule[];
  onOpen: (game: GameModule) => void;
}

/** Library's "Today" row: today's puzzle number + tier, the overall daily
 * streak, and one chip per game with a check once its daily is solved. */
export default function TodayStrip({ games, onOpen }: Props) {
  const { t } = useTranslation();
  const { t: tc } = useTranslation('common');
  const { colors } = useTheme();
  const styles = useStyles();
  const { today, entryFor, overallStreak } = useDailyResults();
  const solvedCount = games.filter((g) => entryFor(g.id, today).solved).length;

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.sectionLabel}>
          {t('daily.todaySection')} · {formatDailyDate(tc, today)} · {t(`difficulty.tiers.${tierForDayNumber(today)}`)}
        </Text>
        <View style={styles.headerRight}>
          {overallStreak.current > 0 && <Text style={styles.streak}>{t('daily.streakDays', { count: overallStreak.current })}</Text>}
          <Text style={styles.progress}>{t('daily.todayProgress', { solved: solvedCount, total: games.length })}</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {games.map((game, i) => {
          const solved = entryFor(game.id, today).solved;
          const accent = game.accentColor ?? colors.signalBlue;
          const name = translateDynamic(t, `${game.id}:meta.name`);
          const Art = game.CardArt;
          return (
            <Animated.View key={game.id} entering={FadeInRight.delay(i * 35).duration(280)}>
              <Pressable
                onPress={() => {
                  void Haptics.selectionAsync();
                  playSound('tap');
                  onOpen(game);
                }}
                style={({ pressed }) => [
                  styles.chip,
                  { borderColor: solved ? `${colors.success}99` : `${accent}55`, backgroundColor: `${accent}14` },
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={t(solved ? 'daily.chipSolvedA11y' : 'daily.chipOpenA11y', { game: name })}
              >
                <View style={solved && styles.solvedArt}>{Art && <Art size={ART_SIZE} color={accent} />}</View>
                {solved && (
                  <Animated.View entering={ZoomIn.springify()} style={[styles.check, { backgroundColor: colors.success }]}>
                    <Ionicons name="checkmark" size={11} color="#fff" />
                  </Animated.View>
                )}
              </Pressable>
              <Text style={styles.chipLabel} numberOfLines={1}>
                {name}
              </Text>
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 8,
    gap: 10,
  },
  sectionLabel: {
    flexShrink: 1,
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.textFaint,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  streak: { fontSize: 12, fontWeight: '600', color: colors.text },
  progress: { fontSize: 12, color: colors.textDim },
  // Top padding leaves room for the solved check, which overhangs the chip.
  row: { paddingHorizontal: 20, paddingTop: 6, gap: 12 },
  chip: {
    width: CHIP_SIZE,
    height: CHIP_SIZE,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.8, transform: [{ scale: 0.95 }] },
  solvedArt: { opacity: 0.45 },
  check: {
    position: 'absolute',
    right: -5,
    top: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bgDeep,
  },
  chipLabel: { width: CHIP_SIZE, marginTop: 5, fontSize: 10.5, color: colors.textDim, textAlign: 'center' },
}));
