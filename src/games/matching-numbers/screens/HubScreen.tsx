import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import GameHubScreen from '../../../components/GameHubScreen';
import { useTheme } from '../../../theme/ThemeProvider';
import { getResumeIndex } from '../../../utils/levelProgress';
import MatchingNumbersCardArt from '../CardArt';
import type { MatchingNumbersStackParamList } from '../navigation';
import { useMatchingNumbersProgress } from '../state/useMatchingNumbersProgress';

type Props = NativeStackScreenProps<MatchingNumbersStackParamList, 'MatchingNumbersHub'>;

export default function HubScreen({ navigation }: Props) {
  const { levelsCompleted, levelsSkipped, tutorialsSeen } = useMatchingNumbersProgress();
  const { t } = useTranslation('matching-numbers');
  const { t: tc } = useTranslation('common');
  const { colors } = useTheme();

  function enterLevel(idx: number) {
    if (!tutorialsSeen.has('all')) {
      navigation.navigate('MatchingNumbersTutorial', { tutorialKey: 'all', pendingLevelIndex: idx });
    } else {
      navigation.navigate('MatchingNumbersGame', { levelIndex: idx });
    }
  }

  const resumeIdx = getResumeIndex(levelsCompleted, levelsSkipped);

  return (
    <GameHubScreen
      onBack={() => navigation.goBack()}
      backAccessibilityLabel={tc('actions.backToLibrary')}
      accentColor={colors.purple}
      CardArt={MatchingNumbersCardArt}
      name={t('meta.name')}
      tagline={t('hub.tagline')}
      playLabel={levelsCompleted.size === 0 && levelsSkipped.size === 0 ? tc('actions.play') : tc('actions.resume')}
      onPlay={() => enterLevel(resumeIdx)}
      levelsLabel={tc('actions.levels')}
      onLevels={() => navigation.navigate('MatchingNumbersLevels')}
      howToPlayLabel={tc('actions.howToPlay')}
      onHowToPlay={() => navigation.navigate('MatchingNumbersTutorial', { tutorialKey: 'all', pendingLevelIndex: null })}
    />
  );
}
