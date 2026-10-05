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
import { useRewardedSkip } from '../../../ads/useRewardedSkip';
import DailyLoading from '../../../daily/DailyLoading';
import { useExitToOrigin } from '../../../daily/navigation';
import { useDailySession } from '../../../daily/useDailySession';
import BlockFillGrid from '../components/BlockFillGrid';
import { computeWin } from '../engine';
import type { BlockFillStackParamList } from '../navigation';
import { paletteForLevel } from '../palette';
import { useBlockFillDailyProgress, useBlockFillProgress } from '../state/useBlockFillProgress';
import type { Cell } from '../types';

type Props = NativeStackScreenProps<BlockFillStackParamList, 'BlockFillGame'>;

export default function GameScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  // In daily mode `levelIndex` is the day number and everything reads/writes the daily store.
  const { levelIndex, daily } = route.params;
  const exitToOrigin = useExitToOrigin(daily, 'BlockFillHub');
  const regularProgress = useBlockFillProgress();
  const dailyProgress = useBlockFillDailyProgress();
  const {
    levelFor,
    ensureLevel,
    pathsByLevel,
    extend,
    rewind,
    giveHint,
    resetLevel,
    markLevelComplete,
    markLevelSkipped,
    levelsCompleted,
    difficulty,
  } = daily ? dailyProgress : regularProgress;
  const { showToast } = useToast();
  const confettiPalette = useMemo(
    () => [colors.purple, colors.gold, colors.cyan, colors.pink, colors.success, colors.signalBlue],
    [colors]
  );
  const { t } = useTranslation('block-fill');
  const { t: tc } = useTranslation('common');

  // Levels are generated on demand, not bundled -- ensureLevel triggers that
  // generation (and persists the result) as a side effect. Prefetch the next
  // one the moment this level opens, same rationale as Kings/Matching Numbers.
  // Not on a daily: there's no "next" one to play, and tomorrow's board is
  // prepared by the daily store itself once that day comes.
  useEffect(() => {
    ensureLevel(levelIndex);
    if (!daily) InteractionManager.runAfterInteractions(() => ensureLevel(levelIndex + 1));
  }, [levelIndex, ensureLevel, daily]);

  const level = levelFor(levelIndex);
  const path = pathsByLevel[levelIndex];

  const [hintCell, setHintCell] = useState<Cell | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Paths persist forever, so reopening an already-completed level would
  // otherwise land straight on the filled board with the win popup showing.
  // Auto-restart it once per mount so there's always a fresh board to play.
  const restartedForLevel = useRef<number | null>(null);
  useEffect(() => {
    if (!level) return;
    if (restartedForLevel.current === levelIndex) return;
    restartedForLevel.current = levelIndex;
    if (levelsCompleted.has(levelIndex)) resetLevel(levelIndex);
  }, [levelIndex, level, levelsCompleted, resetLevel]);

  const win = useMemo(() => (level && path ? computeWin(level, path) : false), [level, path]);
  const palette = useMemo(() => paletteForLevel(levelIndex), [levelIndex]);

  const session = useDailySession({ gameId: 'block-fill', dayNumber: daily ? levelIndex : null, ready: !!level, won: win });

  const { notifyLevelCompleted } = useInterstitialOnComplete('block-fill');
  // An ad owed from an earlier win shows here, between levels -- never over
  // the celebration, and never at the start of a daily (its first solve still
  // counts toward the schedule; the ad waits for the next regular level).
  useInterstitialAtLevelStart(level && !daily ? levelIndex : null);

  const [showConfetti, setShowConfetti] = useState(false);
  useEffect(() => {
    if (!path) return;
    if (win && !levelsCompleted.has(levelIndex)) {
      markLevelComplete(levelIndex);
      if (daily) session.recordWin();
      else posthog?.capture('puzzle_level_completed', { game_id: 'block_fill', level_index: levelIndex + 1 });
      setShowConfetti(true);
      notifyLevelCompleted();
      const t = setTimeout(() => setShowConfetti(false), 1300);
      return () => clearTimeout(t);
    }
  }, [win, path, levelIndex, levelsCompleted, markLevelComplete, notifyLevelCompleted, daily, session.recordWin]);

  useEffect(() => {
    return () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
    };
  }, []);

  function onDragToCell(cell: Cell) {
    if (!path || win) return;
    const tip = path[path.length - 1];
    if (tip.r === cell.r && tip.c === cell.c) return;

    if (hintCell) {
      if (hintTimer.current) clearTimeout(hintTimer.current);
      setHintCell(null);
    }

    const onPath = path.some((p) => p.r === cell.r && p.c === cell.c);
    if (onPath) rewind(levelIndex, cell);
    else extend(levelIndex, cell);
  }

  function attemptHint(): boolean {
    const cell = giveHint(levelIndex);
    if (!cell) {
      showToast(t('game.hintFailToast'));
      return false;
    }
    session.noteHint();
    posthog?.capture('puzzle_hint_requested', { game_id: 'block_fill', level_index: levelIndex + 1, daily: !!daily });
    if (hintTimer.current) clearTimeout(hintTimer.current);
    setHintCell(cell);
    hintTimer.current = setTimeout(() => setHintCell(null), 1500);
    return true;
  }

  const { hintCount, onHintPress } = useHintGate(attemptHint, () => showToast(tc('actions.hintAdNotReady')));

  function replayTutorial() {
    navigation.navigate('BlockFillTutorial', { tutorialKey: 'all', pendingLevelIndex: levelIndex, pendingDaily: daily });
  }

  function nextLevel() {
    navigation.replace('BlockFillGame', { levelIndex: levelIndex + 1 });
  }

  const { requestSkip, isAdReady: isSkipAdReady } = useRewardedSkip(() => {
    markLevelSkipped(levelIndex);
    posthog?.capture('puzzle_level_skipped', { game_id: 'block_fill', level_index: levelIndex + 1 });
    ensureLevel(levelIndex + 1);
    nextLevel();
  });

  function onSkipPress() {
    if (win || daily) return;
    if (!isSkipAdReady) {
      showToast(tc('actions.skipAdNotReady'));
      return;
    }
    requestSkip();
  }

  function onRetryPress() {
    setHintCell(null);
    resetLevel(levelIndex);
  }

  if (!level || !path) {
    return daily ? <DailyLoading accentColor={colors.signalBlue} onBack={exitToOrigin} /> : <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgDeep }} />;
  }

  return (
    <GameScreenLayout
      onBack={exitToOrigin}
      backAccessibilityLabel={tc('actions.backToHub')}
      title={session.title ?? level.title ?? t('game.levelTitle', { number: levelIndex + 1 })}
      headerRight={
        <>
          <IconButton name="help" onPress={replayTutorial} accessibilityLabel={tc('actions.replayTutorial')} />
          <IconButton name="refresh-outline" onPress={onRetryPress} accessibilityLabel={tc('actions.resetLevel')} />
        </>
      }
      controls={
        <View style={{ flexDirection: 'row', gap: 20, justifyContent: 'center' }}>
          <GameActionButton.Hint onPress={onHintPress} accentColor={colors.signalBlue} hintCount={hintCount} />
          {!win && !daily && <GameActionButton.Skip onPress={onSkipPress} accentColor={colors.signalBlue} />}
        </View>
      }
      winOverlay={
        <WinOverlay
          visible={win}
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
      <BlockFillGrid level={level} path={path} palette={palette} onDragToCell={onDragToCell} hintCell={hintCell} />
    </GameScreenLayout>
  );
}
