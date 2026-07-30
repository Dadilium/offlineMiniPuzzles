import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import PulseIcon from '../../../components/PulseIcon';
import TopBar from '../../../components/TopBar';
import { colors, fonts, radii } from '../../../theme/colors';
import type { TentsAndTreesStackParamList } from '../navigation';
import { useTentsAndTreesProgress } from '../state/useTentsAndTreesProgress';

type Props = NativeStackScreenProps<TentsAndTreesStackParamList, 'TentsAndTreesHub'>;

export default function HubScreen({ navigation }: Props) {
  const { levelsCompleted, levelsSkipped, tutorialsSeen } = useTentsAndTreesProgress();
  const { t } = useTranslation('tents-and-trees');
  const { t: tc } = useTranslation('common');

  function enterLevel(idx: number) {
    if (!tutorialsSeen.has('all')) {
      navigation.navigate('TentsAndTreesTutorial', { tutorialKey: 'all', pendingLevelIndex: idx });
    } else {
      navigation.navigate('TentsAndTreesGame', { levelIndex: idx });
    }
  }

  // Levels are generated on demand -- play is strictly sequential, so the
  // count of completed+skipped levels is exactly the index of the next one.
  const resumeIdx = levelsCompleted.size + levelsSkipped.size;

  return (
    <SafeAreaView style={styles.screen}>
      <TopBar onBack={() => navigation.goBack()} backAccessibilityLabel={tc('actions.backToLibrary')} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          <PulseIcon size={84} dotColor={colors.success} />
          <Text style={styles.title}>{t('meta.name')}</Text>
          <Text style={styles.tagline}>{t('hub.tagline')}</Text>
        </View>

        <TouchableOpacity style={styles.playBtn} activeOpacity={0.85} onPress={() => enterLevel(resumeIdx)}>
          <Text style={styles.playBtnText}>
            {levelsCompleted.size === 0 && levelsSkipped.size === 0 ? tc('actions.play') : tc('actions.resume')}
          </Text>
        </TouchableOpacity>

        <View style={styles.secondaryRow}>
          <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.75} onPress={() => navigation.navigate('TentsAndTreesLevels')}>
            <Text style={styles.secondaryBtnText}>{tc('actions.levels')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            activeOpacity={0.75}
            onPress={() => navigation.navigate('TentsAndTreesTutorial', { tutorialKey: 'all', pendingLevelIndex: null })}
          >
            <Text style={styles.secondaryBtnText}>{tc('actions.howToPlay')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDeep },
  scrollContent: { paddingBottom: 32 },
  hero: { marginHorizontal: 20, marginTop: 4, marginBottom: 6, alignItems: 'center', paddingVertical: 18 },
  title: { fontFamily: fonts.display, fontWeight: '700', fontSize: 21, color: colors.text, marginTop: 12 },
  tagline: { fontSize: 12.5, color: colors.textDim, marginTop: 3, maxWidth: 260, lineHeight: 18, textAlign: 'center' },
  playBtn: {
    marginHorizontal: 20,
    marginTop: 2,
    marginBottom: 10,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  playBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  secondaryRow: { flexDirection: 'row', gap: 10, marginHorizontal: 20 },
  secondaryBtn: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  secondaryBtnText: { color: colors.text, fontWeight: '600', fontSize: 14 },
});
