import React, { useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import GameActionButton from '../../../components/GameActionButton';
import GameScreenLayout from '../../../components/GameScreenLayout';
import IconButton from '../../../components/IconButton';
import { useToast } from '../../../components/Toast';
import WinOverlay from '../../../components/WinOverlay';
import { useTheme } from '../../../theme/ThemeProvider';
import { posthog } from '../../../config/posthog';
import { useHintGate } from '../../../ads/useHintGate';
import { useInterstitialAtLevelStart, useInterstitialOnComplete } from '../../../ads/useInterstitialOnComplete';
import { useLatestRef } from '../../../utils/useLatestRef';
import { useRewardedSkip } from '../../../ads/useRewardedSkip';
import DailyLoading from '../../../daily/DailyLoading';
import { useExitToOrigin } from '../../../daily/navigation';
import { useDailySession } from '../../../daily/useDailySession';
import TentsAndTreesGrid, { waveDurationMs } from '../components/TentsAndTreesGrid';
import { computeCounts, computeWin } from '../engine';
import type { TentsAndTreesStackParamList } from '../navigation';
import { useTentsAndTreesDailyProgress, useTentsAndTreesProgress } from '../state/useTentsAndTreesProgress';

type Props = NativeStackScreenProps<TentsAndTreesStackParamList, 'TentsAndTreesGame'>;

const EMPTY_COUNTS = { rowCounts: [] as number[], colCounts: [] as number[] };
const EMPTY_HINTED = new Set<string>();

export default function GameScreen({ route, navigation }: Props) {
  // In daily mode `levelIndex` is the day number and everything reads/writes the daily store.
  const { levelIndex, daily } = route.params;
  const exitToOrigin = useExitToOrigin(daily, 'TentsAndTreesHub');
  const { colors } = useTheme();
  const confettiPalette = useMemo(
    () => [colors.success, colors.signalBlue, colors.warn, colors.purple, colors.cyan, colors.gold],
    [colors]
  );
  const regularProgress = useTentsAndTreesProgress();
  const dailyProgress = useTentsAndTreesDailyProgress();
  const {
    levelFor,
    ensureLevel,
    tentsByLevel,
    hintedCellsByLevel,
    toggleTentAt,
    giveHint,
    resetLevel,
    markLevelComplete,
    markLevelSkipped,
    levelsCompleted,
    difficulty,
  } = daily ? dailyProgress : regularProgress;
  const { showToast } = useToast();
  const { t } = useTranslation('tents-and-trees');
  const { t: tc } = useTranslation('common');

  // Levels are generated on demand, not bundled -- ensureLevel triggers that
  // generation (and persists the result) as a side effect, never during
  // render. Generation is essentially instant at these sizes (see the
  // checkpoint sweep), but the next level is still prefetched the moment
  // this one opens, same pattern as every other game here -- except on a
  // daily, where "next" would be tomorrow's board and nothing leads to it.
  useEffect(() => {
    ensureLevel(levelIndex);
    if (!daily) InteractionManager.runAfterInteractions(() => ensureLevel(levelIndex + 1));
  }, [levelIndex, ensureLevel, daily]);

  const level = levelFor(levelIndex);
  const tents = level ? tentsByLevel[levelIndex] : undefined;
  const hintedCells = hintedCellsByLevel[levelIndex] ?? EMPTY_HINTED;

  const counts = useMemo(() => (level && tents ? computeCounts(tents) : EMPTY_COUNTS), [level, tents]);
  const win = useMemo(() => (level && tents ? computeWin(level, tents) : false), [level, tents]);

  const session = useDailySession({ gameId: 'tents-and-trees', dayNumber: daily ? levelIndex : null, ready: !!level && !!tents, won: win });

  const [celebrate, setCelebrate] = useState(false);
  const [revealWin, setRevealWin] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Guards the win effect below against re-firing: `markLevelComplete`
  // updates `levelsCompleted`, which the progress hook rebuilds as a brand
  // new Set every render -- if that Set were a dependency, the effect would
  // re-run right after triggering, see `win && !levelsCompleted.has(...)`
  // flip to false, and its cleanup would cancel the reveal/confetti timers
  // before they ever fired. A ref keyed on levelIndex sidesteps that.
  const celebratedForLevel = useRef<number | null>(null);

  function resetCelebration() {
    setCelebrate(false);
    setRevealWin(false);
    setShowConfetti(false);
    celebratedForLevel.current = null;
  }

  const { notifyLevelCompleted } = useInterstitialOnComplete('tents-and-trees');
  // An ad owed from an earlier win shows here, between levels -- never over
  // the celebration, and never at the start of a daily (its first solve still
  // counts toward the schedule; the ad waits for the next regular level).
  useInterstitialAtLevelStart(level && !daily ? levelIndex : null);
  // Replays of an already-cleared level never count toward the interstitial
  // schedule -- read at win time, before `markLevelComplete` adds it.
  const levelsCompletedRef = useLatestRef(levelsCompleted);

  // Boards persist forever, so reopening an already-completed level would
  // otherwise land straight on the solved board with the win popup showing.
  // Auto-restart it once per mount so there's always a fresh board to play.
  const restartedForLevel = useRef<number | null>(null);
  useEffect(() => {
    if (!level) return;
    if (restartedForLevel.current === levelIndex) return;
    restartedForLevel.current = levelIndex;
    if (levelsCompleted.has(levelIndex)) {
      resetCelebration();
      resetLevel(levelIndex);
    }
  }, [levelIndex, level, levelsCompleted, resetLevel]);

  // On solve: play the diagonal-wave bounce across the whole board first,
  // then reveal the win overlay/confetti once the wave has swept through --
  // gives the completion a beat of celebration before the popup covers it.
  useEffect(() => {
    if (!level || !tents) return;
    if (!win) return;
    if (celebratedForLevel.current === levelIndex) return;
    celebratedForLevel.current = levelIndex;
    const isFirstClear = !levelsCompletedRef.current.has(levelIndex);

    markLevelComplete(levelIndex);
    if (daily) session.recordWin();
    else posthog?.capture('puzzle_level_completed', { game_id: 'tents_and_trees', level_index: levelIndex + 1 });
    setCelebrate(true);
    const waveMs = waveDurationMs(level.rows, level.cols);
    const revealTimer = setTimeout(() => {
      setRevealWin(true);
      setShowConfetti(true);
      if (isFirstClear) notifyLevelCompleted();
    }, waveMs);
    const confettiTimer = setTimeout(() => setShowConfetti(false), waveMs + 1300);
    return () => {
      clearTimeout(revealTimer);
      clearTimeout(confettiTimer);
    };
    // notifyLevelCompleted, levelsCompletedRef and session.recordWin are all
    // stable, so they can't re-run this effect and cancel the pending reveal timer.
  }, [win, level, tents, levelIndex, markLevelComplete, notifyLevelCompleted, levelsCompletedRef, daily, session.recordWin]);

  function onCellPress(r: number, c: number) {
    toggleTentAt(levelIndex, r, c);
  }

  function onResetPress() {
    resetCelebration();
    resetLevel(levelIndex);
  }

  function attemptHint(): boolean {
    const gaveHint = giveHint(levelIndex);
    if (gaveHint) {
      session.noteHint();
      posthog?.capture('puzzle_hint_requested', { game_id: 'tents_and_trees', level_index: levelIndex + 1, daily: !!daily });
    } else showToast(t('game.hintFailToast'));
    return gaveHint;
  }

  const { hintCount, onHintPress } = useHintGate(attemptHint, () => showToast(tc('actions.hintAdNotReady')));

  function replayTutorial() {
    navigation.navigate('TentsAndTreesTutorial', { tutorialKey: 'all', pendingLevelIndex: levelIndex, pendingDaily: daily });
  }

  function nextLevel() {
    navigation.replace('TentsAndTreesGame', { levelIndex: levelIndex + 1 });
  }

  const { requestSkip, isAdReady: isSkipAdReady } = useRewardedSkip(() => {
    markLevelSkipped(levelIndex);
    posthog?.capture('puzzle_level_skipped', { game_id: 'tents_and_trees', level_index: levelIndex + 1 });
    ensureLevel(levelIndex + 1);
    nextLevel();
  });

  function onSkipPress() {
    if (win) return;
    if (!isSkipAdReady) {
      showToast(tc('actions.skipAdNotReady'));
      return;
    }
    requestSkip();
  }

  if (!level || !tents) {
    return daily ? <DailyLoading accentColor={colors.pink} onBack={exitToOrigin} /> : <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgDeep }} />;
  }

  return (
    <GameScreenLayout
      onBack={exitToOrigin}
      backAccessibilityLabel={tc('actions.backToHub')}
      title={session.title ?? level.title ?? t('game.levelTitle', { number: levelIndex + 1 })}
      headerRight={
        <>
          <IconButton name="help" onPress={replayTutorial} accessibilityLabel={tc('actions.replayTutorial')} />
          <IconButton name="refresh-outline" onPress={onResetPress} accessibilityLabel={tc('actions.resetLevel')} />
        </>
      }
      controls={
        <View style={{ flexDirection: 'row', gap: 20, justifyContent: 'center' }}>
          <GameActionButton.Hint onPress={onHintPress} accentColor={colors.pink} hintCount={hintCount} />
          {!revealWin && !daily && <GameActionButton.Skip onPress={onSkipPress} accentColor={colors.pink} />}
        </View>
      }
      winOverlay={
        <WinOverlay
          visible={revealWin}
          badge="👑"
          showConfetti={showConfetti}
          confettiPalette={confettiPalette}
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
      <TentsAndTreesGrid
        level={level}
        tents={tents}
        hintedCells={hintedCells}
        rowCounts={counts.rowCounts}
        colCounts={counts.colCounts}
        celebrate={celebrate}
        onCellPress={onCellPress}
      />
    </GameScreenLayout>
  );
}
