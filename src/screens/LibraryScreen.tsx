import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import GameCard from '../components/GameCard';
import { translateDynamic } from '../i18n/dynamicKey';
import { games, comingSoon } from '../games/registry';
import { colors, fonts } from '../theme/colors';
import type { RootStackParamList } from '../navigation/types';
type Props = NativeStackScreenProps<RootStackParamList, 'Library'>;

export default function LibraryScreen({ navigation }: Props) {
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>{t('library.eyebrow')}</Text>
          <Text style={styles.title}>{t('library.title')}</Text>
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

      <View style={styles.bottomNav}>
        <View style={styles.navItem}>
          <Text style={[styles.navLabel, styles.navLabelActive]}>{t('library.navLibrary')}</Text>
        </View>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.navLabel}>{t('library.navSettings')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDeep },
  scrollContent: { paddingBottom: 24 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
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
  bottomNav: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    backgroundColor: colors.bg,
    paddingTop: 8,
    paddingBottom: 4,
    paddingHorizontal: 10,
  },
  navItem: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  navLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.textFaint },
  navLabelActive: { color: colors.signalBlue },
});
