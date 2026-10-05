import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import GameHubScreen from '../../../components/GameHubScreen';
import { useHubDifficulty } from '../../../components/useHubDifficulty';
import type { DailyOrigin } from '../../../daily/navigation';
import { useDailyHub } from '../../../daily/useDailyHub';
import { useTheme } from '../../../theme/ThemeProvider';
import { getResumeIndex } from '../../../utils/levelProgress';
import MatchingNumbersCardArt from '../CardArt';
import type { MatchingNumbersStackParamList } from '../navigation';
import { useMatchingNumbersDailyProgress, useMatchingNumbersProgress } from '../state/useMatchingNumbersProgress';

type Props = NativeStackScreenProps<MatchingNumbersStackParamList, 'MatchingNumbersHub'>;

export default function HubScreen({ route, navigation }: Props) {
  const { levelsCompleted, levelsSkipped, tutorialsSeen, difficulty } = useMatchingNumbersProgress();
  const { ensureLevel: ensureDailyLevel } = useMatchingNumbersDailyProgress();
  const { t } = useTranslation('matching-numbers');
  const { t: tc } = useTranslation('common');
  const { colors } = useTheme();

  function enterLevel(idx: number, daily?: DailyOrigin) {
    if (!tutorialsSeen.has('all')) {
      navigation.navigate('MatchingNumbersTutorial', { tutorialKey: 'all', pendingLevelIndex: idx, pendingDaily: daily });
    } else {
      navigation.navigate('MatchingNumbersGame', { levelIndex: idx, daily });
    }
  }

  const dailyProps = useDailyHub({
    gameId: 'matching-numbers',
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
      accentColor={colors.purple}
      CardArt={MatchingNumbersCardArt}
      name={t('meta.name')}
      tagline={t('hub.tagline')}
      daily={dailyProps}
      difficulty={difficultyProps}
      playLabel={levelsCompleted.size === 0 && levelsSkipped.size === 0 ? tc('actions.play') : tc('actions.resume')}
      onPlay={() => enterLevel(resumeIdx)}
      levelsLabel={tc('actions.levels')}
      onLevels={() => navigation.navigate('MatchingNumbersLevels')}
      howToPlayLabel={tc('actions.howToPlay')}
      onHowToPlay={() => navigation.navigate('MatchingNumbersTutorial', { tutorialKey: 'all', pendingLevelIndex: null })}
    />
  );
}
