import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import PulseIcon from '../components/PulseIcon';
import { useToast } from '../components/Toast';
import { games, comingSoon } from '../games/registry';
import { colors, fonts, radii, spacing } from '../theme/colors';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Library'>;

export default function LibraryScreen({ navigation }: Props) {
  const { showToast } = useToast();

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Offline Game Library</Text>
          <Text style={styles.title}>Signal Arcade</Text>
          <Text style={styles.sub}>Pick up, play, no wifi required.</Text>
        </View>

        <Text style={styles.sectionLabel}>Ready to play</Text>
        {games.map((game) => (
          <TouchableOpacity
            key={game.id}
            style={styles.card}
            activeOpacity={0.8}
            onPress={() => navigation.navigate(game.entryScreen as any)}
          >
            <View style={styles.cardIcon}>
              <PulseIcon size={58} dotColor={game.accentColor} />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardName}>{game.name}</Text>
              <Text style={styles.cardTag}>{game.tag}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}

        {comingSoon.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>More frequencies incoming</Text>
            {comingSoon.map((entry, i) => (
              <View key={i} style={styles.cardSoon}>
                <View style={styles.cardSoonIcon} />
                <View style={styles.cardBody}>
                  <Text style={styles.cardSoonName}>{entry.name}</Text>
                  <Text style={styles.cardSoonTag}>{entry.tag}</Text>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <View style={styles.bottomNav}>
        <View style={styles.navItem}>
          <Text style={[styles.navLabel, styles.navLabelActive]}>LIBRARY</Text>
        </View>
        <TouchableOpacity style={styles.navItem} onPress={() => showToast('Settings — coming soon')}>
          <Text style={styles.navLabel}>SETTINGS</Text>
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
  card: {
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  cardIcon: {
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardName: { fontFamily: fonts.display, fontWeight: '700', fontSize: 16.5, color: colors.text },
  cardTag: { fontSize: 12, color: colors.textDim, marginTop: 2 },
  chevron: { color: colors.textFaint, fontSize: 20 },
  cardSoon: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radii.xl,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    opacity: 0.55,
  },
  cardSoonIcon: { width: 58, height: 58, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed' },
  cardSoonName: { fontSize: 15, color: colors.textDim, fontFamily: fonts.display },
  cardSoonTag: { fontSize: 11.5, color: colors.textDim, marginTop: 2 },
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
  spacing: { marginTop: spacing.sm },
});
