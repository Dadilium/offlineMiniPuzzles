import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import GameHubScreen from '../../../components/GameHubScreen';
import { useHubDifficulty } from '../../../components/useHubDifficulty';
import { useTheme } from '../../../theme/ThemeProvider';
import { getResumeIndex } from '../../../utils/levelProgress';
import ArrowsCardArt from '../CardArt';
import type { ArrowsStackParamList } from '../navigation';
import { useArrowsProgress } from '../state/useArrowsProgress';

type Props = NativeStackScreenProps<ArrowsStackParamList, 'ArrowsHub'>;

export default function HubScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { levelsCompleted, levelsSkipped, tutorialsSeen, difficulty } = useArrowsProgress();
  const { t } = useTranslation('arrows');
  const { t: tc } = useTranslation('common');

  function enterLevel(idx: number) {
    if (!tutorialsSeen.has('all')) {
      navigation.navigate('ArrowsTutorial', { tutorialKey: 'all', pendingLevelIndex: idx });
    } else {
      navigation.navigate('ArrowsGame', { levelIndex: idx });
    }
  }

  const resumeIdx = getResumeIndex(levelsCompleted, levelsSkipped);
  const difficultyProps = useHubDifficulty(difficulty, resumeIdx);

  return (
    <GameHubScreen
      onBack={() => navigation.goBack()}
      backAccessibilityLabel={tc('actions.backToLibrary')}
      accentColor={colors.indigo}
      CardArt={ArrowsCardArt}
      name={t('meta.name')}
      tagline={t('hub.tagline')}
      difficulty={difficultyProps}
      playLabel={levelsCompleted.size === 0 && levelsSkipped.size === 0 ? tc('actions.play') : tc('actions.resume')}
      onPlay={() => enterLevel(resumeIdx)}
      levelsLabel={tc('actions.levels')}
      onLevels={() => navigation.navigate('ArrowsLevels')}
      howToPlayLabel={tc('actions.howToPlay')}
      onHowToPlay={() => navigation.navigate('ArrowsTutorial', { tutorialKey: 'all', pendingLevelIndex: null })}
    />
  );
}
