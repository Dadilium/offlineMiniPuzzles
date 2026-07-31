import React, { useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, SafeAreaView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import IconButton from '../../../components/IconButton';
import GameActionButton from '../../../components/GameActionButton';
import GameScreenLayout from '../../../components/GameScreenLayout';
import StatusPill from '../../../components/StatusPill';
import { useToast } from '../../../components/Toast';
import WinOverlay from '../../../components/WinOverlay';
import { colors } from '../../../theme/colors';
import KingsGrid from '../components/KingsGrid';
import { REGION_PALETTE } from '../components/TutorialDiagram';
import { computeAutoUnavailable, computeKingsState } from '../engine';
import type { KingsStackParamList } from '../navigation';
import { useKingsProgress } from '../state/useKingsProgress';

type Props = NativeStackScreenProps<KingsStackParamList, 'KingsGame'>;

const EMPTY_STATE = { kings: [], conflictSet: new Set<string>(), win: false };

export default function GameScreen({ route, navigation }: Props) {
  const { levelIndex } = route.params;
  const {
    levelFor,
    ensureLevel,
    boardsByLevel,
    cycleCell,
    giveHint,
    resetLevel,
    markLevelComplete,
    markLevelSkipped,
    levelsCompleted,
  } = useKingsProgress();
  const { showToast } = useToast();
  const { t } = useTranslation('kings');
  const { t: tc } = useTranslation('common');

  // Levels are generated on demand, not bundled -- ensureLevel triggers that
  // generation (and persists the result) as a side effect, never during
  // render. Generation is usually near-instant, but n=8-9 boards can
  // occasionally take several seconds (rare valid layouts at that size), so
  // the next level is prefetched the moment this one opens -- the whole
  // time the player spends solving this level is the background-generation
  // window, not just the brief win/confetti pause.
  useEffect(() => {
    ensureLevel(levelIndex);
    InteractionManager.runAfterInteractions(() => ensureLevel(levelIndex + 1));
  }, [levelIndex, ensureLevel]);

  const level = levelFor(levelIndex);
  const board = level ? boardsByLevel[levelIndex] : undefined;

  const state = useMemo(() => (level && board ? computeKingsState(level, board) : EMPTY_STATE), [level, board]);
  const autoUnavailable = useMemo(() => (level && board ? computeAutoUnavailable(level, board) : new Set<string>()), [level, board]);

  // Boards persist forever, so reopening an already-completed level would
  // otherwise land straight on the solved board with the win popup showing.
  // Auto-restart it once per mount so there's always a fresh board to play.
  const restartedForLevel = useRef<number | null>(null);
  useEffect(() => {
    if (!level) return;
    if (restartedForLevel.current === levelIndex) return;
    restartedForLevel.current = levelIndex;
    if (levelsCompleted.has(levelIndex)) resetLevel(levelIndex);
  }, [levelIndex, level, levelsCompleted, resetLevel]);

  const [showConfetti, setShowConfetti] = useState(false);
  useEffect(() => {
    if (!level || !board) return;
    if (state.win && !levelsCompleted.has(levelIndex)) {
      markLevelComplete(levelIndex);
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 1300);
      return () => clearTimeout(t);
    }
  }, [state.win, level, board, levelIndex, levelsCompleted, markLevelComplete]);

  function onCellPress(r: number, c: number) {
    cycleCell(levelIndex, r, c);
  }

  function onHintPress() {
    const gaveHint = giveHint(levelIndex);
    if (!gaveHint) showToast(t('game.hintFailToast'));
  }

  function replayTutorial() {
    navigation.navigate('KingsTutorial', { tutorialKey: 'all', pendingLevelIndex: levelIndex });
  }

  function nextLevel() {
    navigation.replace('KingsGame', { levelIndex: levelIndex + 1 });
  }

  function onSkipPress() {
    if (state.win) return;
    markLevelSkipped(levelIndex);
    ensureLevel(levelIndex + 1);
    nextLevel();
  }

  if (!level || !board) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgDeep }} />;
  }

  return (
    <GameScreenLayout
      onBack={() => navigation.navigate('KingsHub')}
      backAccessibilityLabel={tc('actions.backToHub')}
      eyebrow={t('game.levelEyebrow', { number: levelIndex + 1 })}
      title={level.title ?? t('game.levelTitle', { number: levelIndex + 1 })}
      headerRight={
        <>
          <IconButton glyph="?" onPress={replayTutorial} accessibilityLabel={tc('actions.replayTutorial')} />
          <IconButton
            glyph="⟲"
            onPress={() => resetLevel(levelIndex)}
            accessibilityLabel={tc('actions.resetLevel')}
            size={40}
            glyphSize={19}
          />
        </>
      }
      statusRow={
        <>
          <StatusPill color={colors.warn}>{t('game.statusKings', { count: state.kings.length, total: level.n })}</StatusPill>
          <StatusPill color={state.conflictSet.size > 0 ? colors.signalRed : colors.success}>
            {state.conflictSet.size > 0 ? t('game.statusConflict', { count: state.conflictSet.size }) : t('game.statusAllClear')}
          </StatusPill>
        </>
      }
      legend={t('game.legend')}
      controls={
        <>
          <GameActionButton label={tc('actions.hint')} onPress={onHintPress} />
          {!state.win && <GameActionButton label={tc('actions.skipLevelAd')} onPress={onSkipPress} variant="ghost" />}
        </>
      }
      winOverlay={
        <WinOverlay
          visible={state.win}
          badge="👑"
          showConfetti={showConfetti}
          confettiPalette={REGION_PALETTE}
          title={t('game.winTitle')}
          subtitle={t('game.winSubtitle')}
          nextLabel={tc('actions.nextLevel')}
          onNext={nextLevel}
        />
      }
    >
      <KingsGrid
        level={level}
        board={board}
        autoUnavailable={autoUnavailable}
        conflictSet={state.conflictSet}
        onCellPress={onCellPress}
      />
    </GameScreenLayout>
  );
}
