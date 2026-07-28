import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import TopBar from '../../../components/TopBar';
import { colors, fonts, radii } from '../../../theme/colors';
import draftBatches from '../../../../tools/level-creator/drafts/relay/index.generated';
import type { RelayStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RelayStackParamList, 'RelayDraftList'>;

// Dev-only: lets a designer play every level currently sitting in
// tools/level-creator/drafts/relay before running `add` to ship it, so a
// batch can be play-tested and its output/*.md report deleted with
// confidence instead of trusting the automated validator alone.
export default function DraftListScreen({ navigation }: Props) {
  const entries = draftBatches.flatMap((batch) =>
    batch.levels.map((level, indexInFile) => ({ file: batch.file, level, indexInFile }))
  );

  return (
    <SafeAreaView style={styles.screen}>
      <TopBar onBack={() => navigation.goBack()} backAccessibilityLabel="Back to hub" title="Test drafts" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.hint}>
          Draft levels from tools/level-creator/drafts/relay — not shipped yet. Run{' '}
          <Text style={styles.code}>npm run levels -- relay sync</Text> after adding or removing draft files to
          refresh this list.
        </Text>

        {entries.length === 0 ? (
          <Text style={styles.empty}>No draft files found.</Text>
        ) : (
          entries.map(({ file, level, indexInFile }) => (
            <TouchableOpacity
              key={`${file}#${indexInFile}`}
              style={styles.row}
              activeOpacity={0.75}
              onPress={() => navigation.navigate('RelayDraftPlay', { level })}
            >
              <Text style={styles.rowTitle}>{level.title ?? `Untitled level ${indexInFile + 1}`}</Text>
              <Text style={styles.rowFile}>{file}</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDeep },
  scrollContent: { padding: 20, gap: 10 },
  hint: { fontSize: 12, color: colors.textDim, lineHeight: 17, marginBottom: 6 },
  code: { fontFamily: fonts.mono, color: colors.textFaint },
  empty: { fontSize: 13, color: colors.textFaint, textAlign: 'center', marginTop: 24 },
  row: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  rowTitle: { color: colors.text, fontWeight: '600', fontSize: 14.5 },
  rowFile: { color: colors.textFaint, fontSize: 11, fontFamily: fonts.mono, marginTop: 3 },
});
