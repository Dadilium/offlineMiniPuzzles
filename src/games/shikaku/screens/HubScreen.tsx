import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import GameHubScreen from '../../../components/GameHubScreen';
import { colors } from '../../../theme/colors';
import { getResumeIndex } from '../../../utils/levelProgress';
import ShikakuCardArt from '../CardArt';
import type { ShikakuStackParamList } from '../navigation';
import { useShikakuProgress } from '../state/useShikakuProgress';

type Props = NativeStackScreenProps<ShikakuStackParamList, 'ShikakuHub'>;

export default function HubScreen({ navigation }: Props) {
  const { levelsCompleted, levelsSkipped, tutorialsSeen } = useShikakuProgress();
  const { t } = useTranslation('shikaku');
  const { t: tc } = useTranslation('common');

  function enterLevel(idx: number) {
    if (!tutorialsSeen.has('all')) {
      navigation.navigate('ShikakuTutorial', { tutorialKey: 'all', pendingLevelIndex: idx });
    } else {
      navigation.navigate('ShikakuGame', { levelIndex: idx });
    }
  }

  const resumeIdx = getResumeIndex(levelsCompleted, levelsSkipped);

  return (
    <GameHubScreen
      onBack={() => navigation.goBack()}
      backAccessibilityLabel={tc('actions.backToLibrary')}
      accentColor={colors.signalRed}
      CardArt={ShikakuCardArt}
      name={t('meta.name')}
      tagline={t('hub.tagline')}
      playLabel={levelsCompleted.size === 0 && levelsSkipped.size === 0 ? tc('actions.play') : tc('actions.resume')}
      onPlay={() => enterLevel(resumeIdx)}
      levelsLabel={tc('actions.levels')}
      onLevels={() => navigation.navigate('ShikakuLevels')}
      howToPlayLabel={tc('actions.howToPlay')}
      onHowToPlay={() => navigation.navigate('ShikakuTutorial', { tutorialKey: 'all', pendingLevelIndex: null })}
    />
  );
}
