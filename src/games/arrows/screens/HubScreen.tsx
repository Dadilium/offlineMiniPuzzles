import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import GameHubScreen from '../../../components/GameHubScreen';
import { useHubDifficulty } from '../../../components/useHubDifficulty';
import type { DailyOrigin } from '../../../daily/navigation';
import { useDailyHub } from '../../../daily/useDailyHub';
import { useTheme } from '../../../theme/ThemeProvider';
import { getResumeIndex } from '../../../utils/levelProgress';
import ArrowsCardArt from '../CardArt';
import type { ArrowsStackParamList } from '../navigation';
import { useArrowsDailyProgress, useArrowsProgress } from '../state/useArrowsProgress';

type Props = NativeStackScreenProps<ArrowsStackParamList, 'ArrowsHub'>;

export default function HubScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const { levelsCompleted, levelsSkipped, tutorialsSeen, difficulty } = useArrowsProgress();
  const { ensureLevel: ensureDailyLevel } = useArrowsDailyProgress();
  const { t } = useTranslation('arrows');
  const { t: tc } = useTranslation('common');

  function enterLevel(idx: number, daily?: DailyOrigin) {
    if (!tutorialsSeen.has('all')) {
      navigation.navigate('ArrowsTutorial', { tutorialKey: 'all', pendingLevelIndex: idx, pendingDaily: daily });
    } else {
      navigation.navigate('ArrowsGame', { levelIndex: idx, daily });
    }
  }

  const dailyProps = useDailyHub({
    gameId: 'arrows',
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
      accentColor={colors.indigo}
      CardArt={ArrowsCardArt}
      name={t('meta.name')}
      tagline={t('hub.tagline')}
      daily={dailyProps}
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
