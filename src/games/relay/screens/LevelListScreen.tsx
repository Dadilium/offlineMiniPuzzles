import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import GameLevelListScreen from '../../../components/GameLevelListScreen';
import type { LevelStatus } from '../../../components/LevelList';
import { levels } from '../levels';
import { enterLevel as enterLevelNav, type RelayStackParamList } from '../navigation';
import { useRelayProgress } from '../state/useRelayProgress';

type Props = NativeStackScreenProps<RelayStackParamList, 'RelayLevels'>;

export default function LevelListScreen({ navigation }: Props) {
  const { levelsCompleted, levelsSkipped, tutorialsSeen } = useRelayProgress();
  const { t: tc } = useTranslation('common');

  // relay ships a fixed level list (not generated on demand), so -- unlike
  // the other games -- every level gets a row here, with future ones shown
  // locked rather than just stopping at the frontier.
  const items = levels.map((lv, idx) => {
    const locked = idx > 0 && !levelsCompleted.has(idx - 1) && !levelsSkipped.has(idx - 1);
    const complete = levelsCompleted.has(idx);
    const skipped = levelsSkipped.has(idx);
    const status: LevelStatus = locked ? 'locked' : complete ? 'complete' : skipped ? 'skipped' : 'available';
    return { title: lv.title, status };
  });

  function enterLevel(idx: number) {
    enterLevelNav(navigation, idx, tutorialsSeen);
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
