import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import LevelList, { type LevelListItem } from './LevelList';
import TopBar from './TopBar';

interface Props {
  onBack: () => void;
  backAccessibilityLabel?: string;
  title: string;
  items: LevelListItem[];
  onPress: (index: number) => void;
}

/** Shared Levels screen used by every game: TopBar + the level picker list. */
export default function GameLevelListScreen({ onBack, backAccessibilityLabel, title, items, onPress }: Props) {
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <TopBar onBack={onBack} backAccessibilityLabel={backAccessibilityLabel} title={title} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <LevelList items={items} onPress={onPress} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDeep },
  scrollContent: { padding: 20 },
});
