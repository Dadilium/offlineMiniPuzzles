import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import GameHubScreen from '../../../components/GameHubScreen';
import { useTheme } from '../../../theme/ThemeProvider';
import { getResumeIndex } from '../../../utils/levelProgress';
import TentsAndTreesCardArt from '../CardArt';
import type { TentsAndTreesStackParamList } from '../navigation';
import { useTentsAndTreesProgress } from '../state/useTentsAndTreesProgress';

type Props = NativeStackScreenProps<TentsAndTreesStackParamList, 'TentsAndTreesHub'>;

export default function HubScreen({ navigation }: Props) {
  const { colors } = useTheme();
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

  const resumeIdx = getResumeIndex(levelsCompleted, levelsSkipped);

  return (
    <GameHubScreen
      onBack={() => navigation.goBack()}
      backAccessibilityLabel={tc('actions.backToLibrary')}
      accentColor={colors.pink}
      CardArt={TentsAndTreesCardArt}
      name={t('meta.name')}
      tagline={t('hub.tagline')}
      playLabel={levelsCompleted.size === 0 && levelsSkipped.size === 0 ? tc('actions.play') : tc('actions.resume')}
      onPlay={() => enterLevel(resumeIdx)}
      levelsLabel={tc('actions.levels')}
      onLevels={() => navigation.navigate('TentsAndTreesLevels')}
      howToPlayLabel={tc('actions.howToPlay')}
      onHowToPlay={() => navigation.navigate('TentsAndTreesTutorial', { tutorialKey: 'all', pendingLevelIndex: null })}
    />
  );
}
