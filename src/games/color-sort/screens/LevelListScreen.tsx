import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import GameLevelListScreen from '../../../components/GameLevelListScreen';
import { buildSequentialLevelItems } from '../../../utils/levelProgress';
import type { ColorSortStackParamList } from '../navigation';
import { useColorSortProgress } from '../state/useColorSortProgress';

type Props = NativeStackScreenProps<ColorSortStackParamList, 'ColorSortLevels'>;

export default function LevelListScreen({ navigation }: Props) {
  const { levelsCompleted, levelsSkipped, tutorialsSeen } = useColorSortProgress();
  const { t } = useTranslation('color-sort');
  const { t: tc } = useTranslation('common');

  const items = buildSequentialLevelItems(levelsCompleted, levelsSkipped, (idx) => t('game.levelTitle', { number: idx + 1 }));

  function enterLevel(idx: number) {
    if (!tutorialsSeen.has('all')) {
      navigation.navigate('ColorSortTutorial', { tutorialKey: 'all', pendingLevelIndex: idx });
    } else {
      navigation.navigate('ColorSortGame', { levelIndex: idx });
    }
  }

  return (
    <GameLevelListScreen
      onBack={() => navigation.goBack()}
      backAccessibilityLabel={tc('actions.backToHub')}
      title={tc('actions.levels')}
      items={items}
      onPress={enterLevel}
    />
  );
}
