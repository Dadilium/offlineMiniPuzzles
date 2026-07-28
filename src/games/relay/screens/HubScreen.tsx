import React from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import PulseIcon from '../../../components/PulseIcon';
import TopBar from '../../../components/TopBar';
import { useToast } from '../../../components/Toast';
import { colors, fonts, radii } from '../../../theme/colors';
import { levels } from '../levels';
import { enterLevel as enterLevelNav, type RelayStackParamList } from '../navigation';
import { useRelayProgress } from '../state/useRelayProgress';

type Props = NativeStackScreenProps<RelayStackParamList, 'RelayHub'>;

export default function HubScreen({ navigation }: Props) {
  const { levelsCompleted, levelsSkipped, tutorialsSeen, resetAllProgress } = useRelayProgress();
  const { showToast } = useToast();

  function enterLevel(idx: number) {
    enterLevelNav(navigation, idx, tutorialsSeen);
  }

  function confirmResetProgress() {
    Alert.alert(
      'Reset all progress?',
      'Clears every placed relay, completed/skipped level, and seen tutorial. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: resetAllProgress },
      ]
    );
  }

  const allLevelsDone = levels.every((_, i) => levelsCompleted.has(i) || levelsSkipped.has(i));
  let resumeIdx = levels.findIndex((_, i) => !levelsCompleted.has(i) && !levelsSkipped.has(i));
  if (resumeIdx === -1) resumeIdx = 0;

  return (
    <SafeAreaView style={styles.screen}>
      <TopBar onBack={() => navigation.goBack()} backAccessibilityLabel="Back to library" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          <PulseIcon size={84} />
          <Text style={styles.title}>Relay</Text>
          <Text style={styles.tagline}>
            Route a signal from source to receiver by placing a limited number of relay nodes. Range decays with
            distance, walls block line of sight, and crossing signals can jam each other.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.playBtn}
          activeOpacity={0.85}
          onPress={() => {
            if (allLevelsDone) {
              showToast('New puzzles are being crafted — check back soon');
            } else {
              enterLevel(resumeIdx);
            }
          }}
        >
          <Text style={styles.playBtnText}>
            {allLevelsDone ? 'More levels coming soon' : levelsCompleted.size === 0 && levelsSkipped.size === 0 ? 'Play' : 'Resume'}
          </Text>
        </TouchableOpacity>

        <View style={styles.secondaryRow}>
          <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.75} onPress={() => navigation.navigate('RelayLevels')}>
            <Text style={styles.secondaryBtnText}>Levels</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            activeOpacity={0.75}
            onPress={() => navigation.navigate('RelayTutorial', { tutorialKey: 'all', pendingLevelIndex: null })}
          >
            <Text style={styles.secondaryBtnText}>How to play</Text>
          </TouchableOpacity>
        </View>

        {__DEV__ && (
          <View style={styles.devRow}>
            <TouchableOpacity
              style={styles.devResetBtn}
              activeOpacity={0.75}
              onPress={() => navigation.navigate('RelayDraftList')}
            >
              <Text style={styles.devResetBtnText}>Test drafts (dev)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.devResetBtn} activeOpacity={0.75} onPress={confirmResetProgress}>
              <Text style={styles.devResetBtnText}>Reset all progress (dev)</Text>
            </TouchableOpacity>
          </View>
        )}
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
  devRow: { flexDirection: 'row', justifyContent: 'center', gap: 18, marginTop: 6 },
  devResetBtn: { marginHorizontal: 4, marginTop: 8, paddingVertical: 8, alignItems: 'center' },
  devResetBtnText: { color: colors.textFaint, fontWeight: '600', fontSize: 11.5 },
});
