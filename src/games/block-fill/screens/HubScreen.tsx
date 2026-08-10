import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import GameHubScreen from '../../../components/GameHubScreen';
import { useTheme } from '../../../theme/ThemeProvider';
import { getResumeIndex } from '../../../utils/levelProgress';
import BlockFillCardArt from '../CardArt';
import type { BlockFillStackParamList } from '../navigation';
import { useBlockFillProgress } from '../state/useBlockFillProgress';

type Props = NativeStackScreenProps<BlockFillStackParamList, 'BlockFillHub'>;

export default function HubScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { levelsCompleted, levelsSkipped, tutorialsSeen } = useBlockFillProgress();
  const { t } = useTranslation('block-fill');
  const { t: tc } = useTranslation('common');

  function enterLevel(idx: number) {
    if (!tutorialsSeen.has('all')) {
      navigation.navigate('BlockFillTutorial', { tutorialKey: 'all', pendingLevelIndex: idx });
    } else {
      navigation.navigate('BlockFillGame', { levelIndex: idx });
    }
  }

  const resumeIdx = getResumeIndex(levelsCompleted, levelsSkipped);

  return (
    <GameHubScreen
      onBack={() => navigation.goBack()}
      backAccessibilityLabel={tc('actions.backToLibrary')}
      accentColor={colors.signalBlue}
      CardArt={BlockFillCardArt}
      name={t('meta.name')}
      tagline={t('hub.tagline')}
      playLabel={levelsCompleted.size === 0 && levelsSkipped.size === 0 ? tc('actions.play') : tc('actions.resume')}
      onPlay={() => enterLevel(resumeIdx)}
      levelsLabel={tc('actions.levels')}
      onLevels={() => navigation.navigate('BlockFillLevels')}
      howToPlayLabel={tc('actions.howToPlay')}
      onHowToPlay={() => navigation.navigate('BlockFillTutorial', { tutorialKey: 'all', pendingLevelIndex: null })}
    />
  );
}
