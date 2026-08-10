import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import GameHubScreen from '../../../components/GameHubScreen';
import { useTheme } from '../../../theme/ThemeProvider';
import { getResumeIndex } from '../../../utils/levelProgress';
import CrossSumsCardArt from '../CardArt';
import type { CrossSumsStackParamList } from '../navigation';
import { useCrossSumsProgress } from '../state/useCrossSumsProgress';

type Props = NativeStackScreenProps<CrossSumsStackParamList, 'CrossSumsHub'>;

export default function HubScreen({ navigation }: Props) {
  const { levelsCompleted, levelsSkipped, tutorialsSeen } = useCrossSumsProgress();
  const { t } = useTranslation('cross-sums');
  const { t: tc } = useTranslation('common');
  const { colors } = useTheme();

  function enterLevel(idx: number) {
    if (!tutorialsSeen.has('all')) {
      navigation.navigate('CrossSumsTutorial', { tutorialKey: 'all', pendingLevelIndex: idx });
    } else {
      navigation.navigate('CrossSumsGame', { levelIndex: idx });
    }
  }

  const resumeIdx = getResumeIndex(levelsCompleted, levelsSkipped);

  return (
    <GameHubScreen
      onBack={() => navigation.goBack()}
      backAccessibilityLabel={tc('actions.backToLibrary')}
      accentColor={colors.success}
      CardArt={CrossSumsCardArt}
      name={t('meta.name')}
      tagline={t('hub.tagline')}
      playLabel={levelsCompleted.size === 0 && levelsSkipped.size === 0 ? tc('actions.play') : tc('actions.resume')}
      onPlay={() => enterLevel(resumeIdx)}
      levelsLabel={tc('actions.levels')}
      onLevels={() => navigation.navigate('CrossSumsLevels')}
      howToPlayLabel={tc('actions.howToPlay')}
      onHowToPlay={() => navigation.navigate('CrossSumsTutorial', { tutorialKey: 'all', pendingLevelIndex: null })}
    />
  );
}
