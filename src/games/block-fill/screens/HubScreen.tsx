import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import GameHubScreen from '../../../components/GameHubScreen';
import { useHubDifficulty } from '../../../components/useHubDifficulty';
import type { DailyOrigin } from '../../../daily/navigation';
import { useDailyHub } from '../../../daily/useDailyHub';
import { useTheme } from '../../../theme/ThemeProvider';
import { getResumeIndex } from '../../../utils/levelProgress';
import BlockFillCardArt from '../CardArt';
import type { BlockFillStackParamList } from '../navigation';
import { useBlockFillDailyProgress, useBlockFillProgress } from '../state/useBlockFillProgress';

type Props = NativeStackScreenProps<BlockFillStackParamList, 'BlockFillHub'>;

export default function HubScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const { levelsCompleted, levelsSkipped, tutorialsSeen, difficulty } = useBlockFillProgress();
  const { ensureLevel: ensureDailyLevel } = useBlockFillDailyProgress();
  const { t } = useTranslation('block-fill');
  const { t: tc } = useTranslation('common');

  function enterLevel(idx: number, daily?: DailyOrigin) {
    if (!tutorialsSeen.has('all')) {
      navigation.navigate('BlockFillTutorial', { tutorialKey: 'all', pendingLevelIndex: idx, pendingDaily: daily });
    } else {
      navigation.navigate('BlockFillGame', { levelIndex: idx, daily });
    }
  }

  const dailyProps = useDailyHub({
    gameId: 'block-fill',
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
      accentColor={colors.signalBlue}
      CardArt={BlockFillCardArt}
      name={t('meta.name')}
      tagline={t('hub.tagline')}
      daily={dailyProps}
      difficulty={difficultyProps}
      playLabel={levelsCompleted.size === 0 && levelsSkipped.size === 0 ? tc('actions.play') : tc('actions.resume')}
      onPlay={() => enterLevel(resumeIdx)}
      levelsLabel={tc('actions.levels')}
      onLevels={() => navigation.navigate('BlockFillLevels')}
      howToPlayLabel={tc('actions.howToPlay')}
      onHowToPlay={() => navigation.navigate('BlockFillTutorial', { tutorialKey: 'all', pendingLevelIndex: null })}
    />
  );
}
