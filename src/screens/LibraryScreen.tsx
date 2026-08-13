import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import DailyGiftModal from '../components/DailyGiftModal';
import GameCard from '../components/GameCard';
import IconButton from '../components/IconButton';
import { translateDynamic } from '../i18n/dynamicKey';
import { games, comingSoon } from '../games/registry';
import { useHintWallet } from '../state/hintWallet';
import { fonts } from '../theme/tokens';
import { createThemedStyles } from '../theme/createThemedStyles';
import type { RootStackParamList } from '../navigation/types';
type Props = NativeStackScreenProps<RootStackParamList, 'Library'>;

export default function LibraryScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const styles = useStyles();
  const { pendingDailyClaim, acknowledgeDailyClaim } = useHintWallet();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Surfaces the daily free-hint claim exactly once per grant, whenever
       * the player next lands on the Library -- not tied to app-launch
       * timing, since the wallet may claim it before the Library is even
       * the visible screen. */}
      <DailyGiftModal
        visible={pendingDailyClaim !== null}
        amount={pendingDailyClaim ?? 0}
        title={t('library.dailyHintTitle')}
        message={t('library.dailyHintMessage', { count: pendingDailyClaim ?? 0 })}
        confirmLabel={t('library.dailyHintOk')}
        onConfirm={acknowledgeDailyClaim}
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <Text style={styles.eyebrow}>{t('library.eyebrow')}</Text>
              <Text style={styles.title}>{t('library.title')}</Text>
            </View>
            
            <IconButton
              name="settings-outline"
              onPress={() => navigation.navigate('Settings')}
              accessibilityLabel={t('library.navSettings')}
              size={44}
              iconSize={22}
            />
          </View>
          <Text style={styles.sub}>{t('library.subtitle')}</Text>
        </View>

        <Text style={styles.sectionLabel}>{t('library.readySection')}</Text>
        <View style={styles.grid}>
          {games.map((game, i) => (
            <GameCard
              key={game.id}
              index={i}
              title={translateDynamic(t, `${game.id}:meta.name`)}
              tag={translateDynamic(t, `${game.id}:meta.tag`)}
              color={game.accentColor}
              ArtComponent={game.CardArt}
              onPress={() => navigation.navigate(game.entryScreen as any)}
            />
          ))}
        </View>

        {comingSoon.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>{t('library.comingSoonSection')}</Text>
            <View style={styles.grid}>
              {comingSoon.map((entry, i) => (
                <GameCard key={entry.name} index={games.length + i} title={entry.name} tag={entry.tag} locked />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bgDeep },
  scrollContent: { paddingBottom: 24 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  headerText: { flex: 1, minWidth: 0 },
  eyebrow: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 2, color: colors.textFaint, textTransform: 'uppercase' },
  title: { fontFamily: fonts.display, fontSize: 23, fontWeight: '700', color: colors.text, marginTop: 2 },
  sub: { fontSize: 12.5, color: colors.textDim, marginTop: 2, marginBottom: 6 },
  sectionLabel: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.textFaint,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 14,
  },
}));
