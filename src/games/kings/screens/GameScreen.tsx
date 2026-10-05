import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, InteractionManager, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import IconButton from '../../../components/IconButton';
import GameActionButton from '../../../components/GameActionButton';
import GameScreenLayout from '../../../components/GameScreenLayout';
import { useToast } from '../../../components/Toast';
import WinOverlay from '../../../components/WinOverlay';
import { fonts } from '../../../theme/tokens';
import { createThemedStyles } from '../../../theme/createThemedStyles';
import { useTheme } from '../../../theme/ThemeProvider';
import { posthog } from '../../../config/posthog';
import { useHintGate } from '../../../ads/useHintGate';
import { useInterstitialAtLevelStart, useInterstitialOnComplete } from '../../../ads/useInterstitialOnComplete';
import { useRewardedSkip } from '../../../ads/useRewardedSkip';
import DailyLoading from '../../../daily/DailyLoading';
import { useExitToOrigin } from '../../../daily/navigation';
import { useDailySession } from '../../../daily/useDailySession';
import KingsGrid from '../components/KingsGrid';
import { useRegionPalette } from '../components/TutorialDiagram';
import { computeAutoUnavailable, computeKingsState, showsAutoMarks, type MarkStrokeMode } from '../engine';
import type { KingsStackParamList } from '../navigation';
import { useKingsDailyProgress, useKingsProgress } from '../state/useKingsProgress';

type Props = NativeStackScreenProps<KingsStackParamList, 'KingsGame'>;

const EMPTY_STATE = { kings: [], conflictSet: new Set<string>(), win: false };

export default function GameScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const regionPalette = useRegionPalette();
  // In daily mode `levelIndex` is the day number and everything reads/writes the daily store.
  const { levelIndex, daily } = route.params;
  const exitToOrigin = useExitToOrigin(daily, 'KingsHub');
  const regularProgress = useKingsProgress();
  const dailyProgress = useKingsDailyProgress();
  const {
    levelFor,
    ensureLevel,
    boardsByLevel,
    cycleCell,
    paintMarks,
    giveHint,
    resetLevel,
    markLevelComplete,
    markLevelSkipped,
    levelsCompleted,
    difficulty,
  } = daily ? dailyProgress : regularProgress;
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
  // urgent call below is just a no-op recheck. A daily has no "next level"
  // to prefetch -- tomorrow's board is built when tomorrow comes.
  useEffect(() => {
    ensureLevel(levelIndex, { urgent: true });
    if (daily) return;
    InteractionManager.runAfterInteractions(() => {
      ensureLevel(levelIndex + 1);
      ensureLevel(levelIndex + 2);
    });
  }, [levelIndex, ensureLevel, daily]);

  const level = levelFor(levelIndex);
  const board = level ? boardsByLevel[levelIndex] : undefined;

  const state = useMemo(() => (level && board ? computeKingsState(level, board) : EMPTY_STATE), [level, board]);
  const session = useDailySession({ gameId: 'kings', dayNumber: daily ? levelIndex : null, ready: !!level && !!board, won: state.win });
  const autoUnavailable = useMemo(
    () => (level && board && showsAutoMarks(level, difficulty.selectedTier) ? computeAutoUnavailable(level, board) : new Set<string>()),
    [level, board, difficulty.selectedTier]
  );

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

  const { notifyLevelCompleted } = useInterstitialOnComplete('kings');
  // An ad owed from an earlier win shows here, between levels -- never over
  // the celebration, and never at the start of a daily (its first solve still
  // counts toward the schedule; the ad waits for the next regular level).
  useInterstitialAtLevelStart(level && !daily ? levelIndex : null);

  const [showConfetti, setShowConfetti] = useState(false);
  useEffect(() => {
    if (!level || !board) return;
    if (state.win && !levelsCompleted.has(levelIndex)) {
      markLevelComplete(levelIndex);
      if (daily) session.recordWin();
      else posthog?.capture('puzzle_level_completed', { game_id: 'kings', level_index: levelIndex + 1 });
      setShowConfetti(true);
      notifyLevelCompleted();
      const t = setTimeout(() => setShowConfetti(false), 1300);
      return () => clearTimeout(t);
    }
  }, [state.win, level, board, levelIndex, levelsCompleted, markLevelComplete, notifyLevelCompleted, daily, session.recordWin]);

  function onCellPress(r: number, c: number) {
    cycleCell(levelIndex, r, c);
  }

  function onMarkStroke(cells: Array<[number, number]>, mode: MarkStrokeMode) {
    paintMarks(levelIndex, cells, mode);
  }

  function attemptHint(): boolean {
    const gaveHint = giveHint(levelIndex);
    if (gaveHint) {
      session.noteHint();
      posthog?.capture('puzzle_hint_requested', { game_id: 'kings', level_index: levelIndex + 1, daily: !!daily });
    } else showToast(t('game.hintFailToast'));
    return gaveHint;
  }

  const { hintCount, onHintPress } = useHintGate(attemptHint, () => showToast(tc('actions.hintAdNotReady')));

  function replayTutorial() {
    navigation.navigate('KingsTutorial', { tutorialKey: 'all', pendingLevelIndex: levelIndex, pendingDaily: daily });
  }

  function nextLevel() {
    navigation.replace('KingsGame', { levelIndex: levelIndex + 1 });
  }

  const { requestSkip, isAdReady: isSkipAdReady } = useRewardedSkip(() => {
    markLevelSkipped(levelIndex);
    posthog?.capture('puzzle_level_skipped', { game_id: 'kings', level_index: levelIndex + 1 });
    ensureLevel(levelIndex + 1);
    nextLevel();
  });

  function onSkipPress() {
    if (state.win) return;
    if (!isSkipAdReady) {
      showToast(tc('actions.skipAdNotReady'));
      return;
    }
    requestSkip();
  }

  // Normally invisible -- ensureLevel already generated (and prefetched) this
  // level well before the player got here. Only shows up if generation is
  // still running against its wall-clock deadline (see levelSource.ts), so
  // it must never look frozen: a real spinner rather than a blank screen.
  if (!level || !board) {
    if (daily) return <DailyLoading accentColor={colors.warn} onBack={exitToOrigin} />;
    return (
      <GameScreenLayout
        onBack={exitToOrigin}
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
      onBack={exitToOrigin}
      backAccessibilityLabel={tc('actions.backToHub')}
      title={session.title ?? level.title ?? t('game.levelTitle', { number: levelIndex + 1 })}
      headerRight={
        <>
          <IconButton name="help" onPress={replayTutorial} accessibilityLabel={tc('actions.replayTutorial')} />
          <IconButton name="refresh-outline" onPress={() => resetLevel(levelIndex)} accessibilityLabel={tc('actions.resetLevel')} />
        </>
      }
      controls={
        <View style={{ flexDirection: 'row', gap: 20, justifyContent: 'center' }}>
          <GameActionButton.Hint onPress={onHintPress} accentColor={colors.warn} hintCount={hintCount} />
          {!state.win && !daily && <GameActionButton.Skip onPress={onSkipPress} accentColor={colors.warn} />}
        </View>
      }
      winOverlay={
        <WinOverlay
          visible={state.win}
          badge="👑"
          showConfetti={showConfetti}
          confettiPalette={regionPalette}
          title={daily ? tc('daily.winTitle') : t('game.winTitle')}
          subtitle={daily ? session.winSubtitle : t('game.winSubtitle')}
          nextLabel={daily ? tc('daily.share') : tc('actions.nextLevel')}
          onNext={daily ? session.share : nextLevel}
          secondaryLabel={daily ? tc('daily.done') : undefined}
          onSecondary={exitToOrigin}
          unlockedTier={!daily && difficulty.hasNewUnlock ? difficulty.unlockedTier : null}
          onUnlockSeen={difficulty.markUnlockSeen}
        />
      }
    >
      <KingsGrid
        level={level}
        board={board}
        autoUnavailable={autoUnavailable}
        conflictSet={state.conflictSet}
        onCellPress={onCellPress}
        onMarkStroke={onMarkStroke}
      />
    </GameScreenLayout>
  );
}

const useStyles = createThemedStyles((colors) => ({
  loading: { alignItems: 'center', gap: 12 },
  loadingText: { fontFamily: fonts.body, fontSize: 13, color: colors.textDim },
}));
