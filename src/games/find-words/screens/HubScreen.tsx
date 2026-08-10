import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import GameHubScreen from '../../../components/GameHubScreen';
import { useTheme } from '../../../theme/ThemeProvider';
import { getResumeIndex } from '../../../utils/levelProgress';
import FindWordsCardArt from '../CardArt';
import type { FindWordsStackParamList } from '../navigation';
import { useFindWordsProgress } from '../state/useFindWordsProgress';

type Props = NativeStackScreenProps<FindWordsStackParamList, 'FindWordsHub'>;

export default function HubScreen({ navigation }: Props) {
  const { levelsCompleted, levelsSkipped, tutorialsSeen } = useFindWordsProgress();
  const { colors } = useTheme();
  const { t } = useTranslation('find-words');
  const { t: tc } = useTranslation('common');

  function enterLevel(idx: number) {
    if (!tutorialsSeen.has('all')) {
      navigation.navigate('FindWordsTutorial', { tutorialKey: 'all', pendingLevelIndex: idx });
    } else {
      navigation.navigate('FindWordsGame', { levelIndex: idx });
    }
  }

  const resumeIdx = getResumeIndex(levelsCompleted, levelsSkipped);

  return (
    <GameHubScreen
      onBack={() => navigation.goBack()}
      backAccessibilityLabel={tc('actions.backToLibrary')}
      accentColor={colors.teal}
      CardArt={FindWordsCardArt}
      name={t('meta.name')}
      tagline={t('hub.tagline')}
      playLabel={levelsCompleted.size === 0 && levelsSkipped.size === 0 ? tc('actions.play') : tc('actions.resume')}
      onPlay={() => enterLevel(resumeIdx)}
      levelsLabel={tc('actions.levels')}
      onLevels={() => navigation.navigate('FindWordsLevels')}
      howToPlayLabel={tc('actions.howToPlay')}
      onHowToPlay={() => navigation.navigate('FindWordsTutorial', { tutorialKey: 'all', pendingLevelIndex: null })}
    />
  );
}
