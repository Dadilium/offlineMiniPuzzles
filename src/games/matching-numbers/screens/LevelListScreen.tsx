import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import LevelList, { type LevelStatus } from '../../../components/LevelList';
import TopBar from '../../../components/TopBar';
import { colors } from '../../../theme/colors';
import type { MatchingNumbersStackParamList } from '../navigation';
import { useMatchingNumbersProgress } from '../state/useMatchingNumbersProgress';

type Props = NativeStackScreenProps<MatchingNumbersStackParamList, 'MatchingNumbersLevels'>;

export default function LevelListScreen({ navigation }: Props) {
  const { levelsCompleted, levelsSkipped, tutorialsSeen } = useMatchingNumbersProgress();
  const { t } = useTranslation('matching-numbers');
  const { t: tc } = useTranslation('common');

  // Levels are generated on demand, not a fixed list -- play is strictly
  // sequential (each level unlocks the next), so completed+skipped is
  // exactly the count of levels reached so far, and the one right after
  // them is the next available one. Nothing beyond that needs a row.
  const frontier = levelsCompleted.size + levelsSkipped.size;
  const items: Array<{ title: string; status: LevelStatus }> = [];
  for (let idx = 0; idx <= frontier; idx++) {
    const complete = levelsCompleted.has(idx);
    const skipped = levelsSkipped.has(idx);
    const status: LevelStatus = complete ? 'complete' : skipped ? 'skipped' : 'available';
    items.push({ title: t('game.levelTitle', { number: idx + 1 }), status });
  }

  function enterLevel(idx: number) {
    if (!tutorialsSeen.has('all')) {
      navigation.navigate('MatchingNumbersTutorial', { tutorialKey: 'all', pendingLevelIndex: idx });
    } else {
      navigation.navigate('MatchingNumbersGame', { levelIndex: idx });
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <TopBar onBack={() => navigation.goBack()} backAccessibilityLabel={tc('actions.backToHub')} title={tc('actions.levels')} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <LevelList items={items} onPress={enterLevel} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDeep },
  scrollContent: { padding: 20 },
});
