import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, InteractionManager, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import IconButton from '../../../components/IconButton';
import GameActionButton from '../../../components/GameActionButton';
import GameScreenLayout from '../../../components/GameScreenLayout';
import StatusPill from '../../../components/StatusPill';
import { useToast } from '../../../components/Toast';
import WinOverlay from '../../../components/WinOverlay';
import { colors, fonts } from '../../../theme/colors';
import { posthog } from '../../../config/posthog';
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
  // render. The search yields back to the JS thread in small chunks so it
  // never freezes touches/animations. This level is marked `urgent` since
  // the player is looking right at the loading state if it isn't ready
  // (tight wall-clock cap, more likely to fall back a rung); the two
  // prefetched-ahead levels are not urgent, since nothing is waiting on them
  // yet -- they get a far more generous cap to find the true skill-matched
  // board before settling for anything easier. In the common case this
  // level was itself already satisfied by a prior screen's prefetch, so the
  // urgent call below is just a no-op recheck.
  useEffect(() => {
    ensureLevel(levelIndex, { urgent: true });
    InteractionManager.runAfterInteractions(() => {
      ensureLevel(levelIndex + 1);
      ensureLevel(levelIndex + 2);
    });
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
      posthog?.capture('puzzle_level_completed', { game_id: 'kings', level_index: levelIndex + 1 });
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
    if (gaveHint) posthog?.capture('puzzle_hint_requested', { game_id: 'kings', level_index: levelIndex + 1 });
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
    posthog?.capture('puzzle_level_skipped', { game_id: 'kings', level_index: levelIndex + 1 });
    ensureLevel(levelIndex + 1);
    nextLevel();
  }

  // Normally invisible -- ensureLevel already generated (and prefetched) this
  // level well before the player got here. Only shows up if generation is
  // still running against its wall-clock deadline (see levelSource.ts), so
  // it must never look frozen: a real spinner rather than a blank screen.
  if (!level || !board) {
    return (
      <GameScreenLayout
        onBack={() => navigation.navigate('KingsHub')}
        backAccessibilityLabel={tc('actions.backToHub')}
        title={t('game.levelTitle', { number: levelIndex + 1 })}
      >
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.accentBright} />
          <Text style={styles.loadingText}>{t('game.generatingLabel')}</Text>
        </View>
      </GameScreenLayout>
    );
  }

  return (
    <GameScreenLayout
      onBack={() => navigation.navigate('KingsHub')}
      backAccessibilityLabel={tc('actions.backToHub')}
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
          {state.conflictSet.size > 0 && (
            <StatusPill color={colors.signalRed}>{t('game.statusConflict', { count: state.conflictSet.size })}</StatusPill>
          )}
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

const styles = StyleSheet.create({
  loading: { alignItems: 'center', gap: 12 },
  loadingText: { fontFamily: fonts.body, fontSize: 13, color: colors.textDim },
});
