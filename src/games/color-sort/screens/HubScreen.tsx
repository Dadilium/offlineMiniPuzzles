import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import GameHubScreen from '../../../components/GameHubScreen';
import { useHubDifficulty } from '../../../components/useHubDifficulty';
import type { DailyOrigin } from '../../../daily/navigation';
import { useDailyHub } from '../../../daily/useDailyHub';
import { useTheme } from '../../../theme/ThemeProvider';
import { getResumeIndex } from '../../../utils/levelProgress';
import ColorSortCardArt from '../CardArt';
import ColorblindToggleRow from '../components/ColorblindToggleRow';
import type { ColorSortStackParamList } from '../navigation';
import { useColorSortDailyProgress, useColorSortProgress } from '../state/useColorSortProgress';

type Props = NativeStackScreenProps<ColorSortStackParamList, 'ColorSortHub'>;

export default function HubScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const { levelsCompleted, levelsSkipped, tutorialsSeen, difficulty, showColorblindIcons, setShowColorblindIcons } = useColorSortProgress();
  const { ensureLevel: ensureDailyLevel } = useColorSortDailyProgress();
  const { t } = useTranslation('color-sort');
  const { t: tc } = useTranslation('common');

  function enterLevel(idx: number, daily?: DailyOrigin) {
    if (!tutorialsSeen.has('all')) {
      navigation.navigate('ColorSortTutorial', { tutorialKey: 'all', pendingLevelIndex: idx, pendingDaily: daily });
    } else {
      navigation.navigate('ColorSortGame', { levelIndex: idx, daily });
    }
  }

  const dailyProps = useDailyHub({
    gameId: 'color-sort',
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
      accentColor={colors.cyan}
      CardArt={ColorSortCardArt}
      name={t('meta.name')}
      tagline={t('hub.tagline')}
      daily={dailyProps}
      difficulty={difficultyProps}
      playLabel={levelsCompleted.size === 0 && levelsSkipped.size === 0 ? tc('actions.play') : tc('actions.resume')}
      onPlay={() => enterLevel(resumeIdx)}
      levelsLabel={tc('actions.levels')}
      onLevels={() => navigation.navigate('ColorSortLevels')}
      howToPlayLabel={tc('actions.howToPlay')}
      onHowToPlay={() => navigation.navigate('ColorSortTutorial', { tutorialKey: 'all', pendingLevelIndex: null })}
      aboveActions={
        <ColorblindToggleRow
          label={t('hub.colorblindToggleLabel')}
          sub={t('hub.colorblindToggleSub')}
          value={showColorblindIcons}
          onChange={setShowColorblindIcons}
          accentColor={colors.cyan}
        />
      }
    />
  );
}
