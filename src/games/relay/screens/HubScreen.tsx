import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import GameHubScreen from '../../../components/GameHubScreen';
import { useToast } from '../../../components/Toast';
import { colors } from '../../../theme/colors';
import { getResumeIndex } from '../../../utils/levelProgress';
import RelayCardArt from '../CardArt';
import { levels } from '../levels';
import { enterLevel as enterLevelNav, type RelayStackParamList } from '../navigation';
import { useRelayProgress } from '../state/useRelayProgress';

type Props = NativeStackScreenProps<RelayStackParamList, 'RelayHub'>;

export default function HubScreen({ navigation }: Props) {
  const { levelsCompleted, levelsSkipped, tutorialsSeen, resetAllProgress } = useRelayProgress();
  const { showToast } = useToast();
  const { t } = useTranslation('relay');
  const { t: tc } = useTranslation('common');

  function enterLevel(idx: number) {
    enterLevelNav(navigation, idx, tutorialsSeen);
  }

  // Dev-only debug action (see the __DEV__-gated button below) -- left
  // English-only, same as the rest of this file's dev tooling.
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

  // relay ships a fixed level list (not generated on demand), so -- unlike
  // the other games -- there's a real "every level done" end state to guard
  // for, on top of the shared resume-index logic.
  const allLevelsDone = levels.every((_, i) => levelsCompleted.has(i) || levelsSkipped.has(i));
  const resumeIdx = getResumeIndex(levelsCompleted, levelsSkipped);

  return (
    <GameHubScreen
      onBack={() => navigation.goBack()}
      backAccessibilityLabel={tc('actions.backToLibrary')}
      accentColor={colors.signalBlue}
      CardArt={RelayCardArt}
      name={t('meta.name')}
      tagline={t('hub.tagline')}
      playLabel={
        allLevelsDone
          ? t('game.moreLevelsSoon')
          : levelsCompleted.size === 0 && levelsSkipped.size === 0
            ? tc('actions.play')
            : tc('actions.resume')
      }
      onPlay={() => {
        if (allLevelsDone) {
          showToast(t('game.allLevelsDoneToast'));
        } else {
          enterLevel(resumeIdx);
        }
      }}
      levelsLabel={tc('actions.levels')}
      onLevels={() => navigation.navigate('RelayLevels')}
      howToPlayLabel={tc('actions.howToPlay')}
      onHowToPlay={() => navigation.navigate('RelayTutorial', { tutorialKey: 'all', pendingLevelIndex: null })}
      aboveActions={
        __DEV__ ? (
          <View style={styles.devRow}>
            <TouchableOpacity style={styles.devResetBtn} activeOpacity={0.75} onPress={() => navigation.navigate('RelayDraftList')}>
              <Text style={styles.devResetBtnText}>Test drafts (dev)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.devResetBtn} activeOpacity={0.75} onPress={confirmResetProgress}>
              <Text style={styles.devResetBtnText}>Reset all progress (dev)</Text>
            </TouchableOpacity>
          </View>
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  devRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 4 },
  devResetBtn: { marginHorizontal: 4, paddingVertical: 4, alignItems: 'center' },
  devResetBtnText: { color: colors.textFaint, fontWeight: '600', fontSize: 11.5 },
});
