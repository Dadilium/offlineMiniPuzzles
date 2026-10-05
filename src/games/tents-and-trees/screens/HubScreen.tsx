import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import GameHubScreen from '../../../components/GameHubScreen';
import { useHubDifficulty } from '../../../components/useHubDifficulty';
import type { DailyOrigin } from '../../../daily/navigation';
import { useDailyHub } from '../../../daily/useDailyHub';
import { useTheme } from '../../../theme/ThemeProvider';
import { getResumeIndex } from '../../../utils/levelProgress';
import TentsAndTreesCardArt from '../CardArt';
import type { TentsAndTreesStackParamList } from '../navigation';
import { useTentsAndTreesDailyProgress, useTentsAndTreesProgress } from '../state/useTentsAndTreesProgress';

type Props = NativeStackScreenProps<TentsAndTreesStackParamList, 'TentsAndTreesHub'>;

export default function HubScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const { levelsCompleted, levelsSkipped, tutorialsSeen, difficulty } = useTentsAndTreesProgress();
  const { ensureLevel: ensureDailyLevel } = useTentsAndTreesDailyProgress();
  const { t } = useTranslation('tents-and-trees');
  const { t: tc } = useTranslation('common');

  function enterLevel(idx: number, daily?: DailyOrigin) {
    if (!tutorialsSeen.has('all')) {
      navigation.navigate('TentsAndTreesTutorial', { tutorialKey: 'all', pendingLevelIndex: idx, pendingDaily: daily });
    } else {
      navigation.navigate('TentsAndTreesGame', { levelIndex: idx, daily });
    }
  }

  const dailyProps = useDailyHub({
    gameId: 'tents-and-trees',
    ensureDailyLevel,
    enterDaily: (day, origin) => enterLevel(day, origin),
    startDailyParam: route.params?.startDaily,
    clearStartDailyParam: () => navigation.setParams({ startDaily: undefined }),
  });

  const resumeIdx = getResumeIndex(levelsCompleted, levelsSkipped);
  const difficultyProps = useHubDifficulty(difficulty, resumeIdx);

  return (
    <GameHubScreen
      onBack={() => navigation.goBack()}
      backAccessibilityLabel={tc('actions.backToLibrary')}
      accentColor={colors.pink}
      CardArt={TentsAndTreesCardArt}
      name={t('meta.name')}
      tagline={t('hub.tagline')}
      daily={dailyProps}
      difficulty={difficultyProps}
      playLabel={levelsCompleted.size === 0 && levelsSkipped.size === 0 ? tc('actions.play') : tc('actions.resume')}
      onPlay={() => enterLevel(resumeIdx)}
      levelsLabel={tc('actions.levels')}
      onLevels={() => navigation.navigate('TentsAndTreesLevels')}
      howToPlayLabel={tc('actions.howToPlay')}
      onHowToPlay={() => navigation.navigate('TentsAndTreesTutorial', { tutorialKey: 'all', pendingLevelIndex: null })}
    />
  );
}
