import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, InteractionManager, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import GameActionButton from '../../../components/GameActionButton';
import GameScreenLayout from '../../../components/GameScreenLayout';
import IconButton from '../../../components/IconButton';
import LevelFailedOverlay from '../../../components/LevelFailedOverlay';
import { useToast } from '../../../components/Toast';
import WinOverlay from '../../../components/WinOverlay';
import { useTheme } from '../../../theme/ThemeProvider';
import { posthog } from '../../../config/posthog';
import { ARROWS_RETRY_AD_SCHEDULE } from '../../../config/ads';
import { useHintGate } from '../../../ads/useHintGate';
import { useInterstitialAtLevelStart, useInterstitialOnAction, useInterstitialOnComplete } from '../../../ads/useInterstitialOnComplete';
import { useLatestRef } from '../../../utils/useLatestRef';
import { useRewardedSkip } from '../../../ads/useRewardedSkip';
import ArrowsBoard, { type ArrowsBoardHandle } from '../components/ArrowsBoard';
import LivesBar from '../components/LivesBar';
import { isCleared, MAX_LIVES } from '../engine';
import type { ArrowsStackParamList } from '../navigation';
import { useArrowsProgress } from '../state/useArrowsProgress';
import type { ArrowsPlayerState } from '../types';

type Props = NativeStackScreenProps<ArrowsStackParamList, 'ArrowsGame'>;

const FRESH_BOARD: ArrowsPlayerState = { removed: [], livesLeft: MAX_LIVES };

export default function GameScreen({ route, navigation }: Props) {
  const { levelIndex } = route.params;
  const { colors } = useTheme();
  const accent = colors.indigo;
  const confettiPalette = useMemo(() => [colors.indigo, colors.signalBlue, colors.gold, colors.purple, colors.cyan, colors.pink], [colors]);
  const {
    levelFor,
    ensureLevel,
    boardByLevel,
    launchArrow,
    registerBump,
    retryLevel,
    hintCandidates,
    giveHint,
    resetLevel,
    markLevelComplete,
    markLevelSkipped,
    levelsCompleted,
    difficulty,
  } = useArrowsProgress();
  const { showToast } = useToast();
  const { t } = useTranslation('arrows');
  const { t: tc } = useTranslation('common');
  const boardRef = useRef<ArrowsBoardHandle>(null);

  // Levels are generated on demand and the next one is prefetched once this
  // one has opened -- same pattern as every other game here.
  useEffect(() => {
    ensureLevel(levelIndex);
    InteractionManager.runAfterInteractions(() => ensureLevel(levelIndex + 1));
  }, [levelIndex, ensureLevel]);

  const level = levelFor(levelIndex);
  const board = (level && boardByLevel[levelIndex]) || FRESH_BOARD;
  const removedSet = useMemo(() => new Set(board.removed), [board.removed]);
  const win = level ? isCleared(level, removedSet) : false;
  const outOfLives = !win && board.livesLeft <= 0;

  const [celebrate, setCelebrate] = useState(false);
  const [revealWin, setRevealWin] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  // See Shikaku's GameScreen: a ref keyed on levelIndex keeps the win effect
  // from re-firing off the rebuilt `levelsCompleted` Set.
  const celebratedForLevel = useRef<number | null>(null);
  const confettiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearConfettiTimer() {
    if (confettiTimerRef.current) {
      clearTimeout(confettiTimerRef.current);
      confettiTimerRef.current = null;
    }
  }

  function resetCelebration() {
    clearConfettiTimer();
    setCelebrate(false);
    setRevealWin(false);
    setShowConfetti(false);
    celebratedForLevel.current = null;
  }

  useEffect(() => clearConfettiTimer, []);

  const { notifyLevelCompleted } = useInterstitialOnComplete('arrows');
  // An ad owed from an earlier win shows here, between levels -- never over the celebration.
  useInterstitialAtLevelStart(level ? levelIndex : null);
  // Retrying after running out of hearts is a break the player chose, so a
  // due ad shows right away -- over the freshly reset board.
  const { notifyAction: notifyRetry } = useInterstitialOnAction('arrows', 'retry', ARROWS_RETRY_AD_SCHEDULE);
  // Replays of an already-cleared level never count toward the interstitial
  // schedule -- read at win time, before `markLevelComplete` adds it.
  const levelsCompletedRef = useLatestRef(levelsCompleted);
  const firstClearRef = useRef(false);

  // Reopening an already-cleared level would land on an empty board with the
  // win popup up -- restart it once per mount instead.
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

  useEffect(() => {
    if (!level || !win) return;
    if (celebratedForLevel.current === levelIndex) return;
    celebratedForLevel.current = levelIndex;
    firstClearRef.current = !levelsCompletedRef.current.has(levelIndex);
    markLevelComplete(levelIndex);
    posthog?.capture('puzzle_level_completed', { game_id: 'arrows', level_index: levelIndex + 1 });
    setCelebrate(true);
  }, [win, level, levelIndex, markLevelComplete]);

  useEffect(() => {
    if (outOfLives) posthog?.capture('puzzle_level_failed', { game_id: 'arrows', level_index: levelIndex + 1 });
  }, [outOfLives, levelIndex]);

  const handleCelebrationDone = useCallback(() => {
    setRevealWin(true);
    setShowConfetti(true);
    if (firstClearRef.current) notifyLevelCompleted();
    clearConfettiTimer();
    confettiTimerRef.current = setTimeout(() => setShowConfetti(false), 1300);
  }, [notifyLevelCompleted]);

  const onTapArrow = useCallback((arrowId: number) => launchArrow(levelIndex, arrowId), [launchArrow, levelIndex]);
  const onBumpImpact = useCallback(() => {
    registerBump(levelIndex);
  }, [registerBump, levelIndex]);

  function onResetPress() {
    resetCelebration();
    resetLevel(levelIndex);
  }

  function onRetry() {
    retryLevel(levelIndex);
    notifyRetry();
  }

  function attemptHint(): boolean {
    if (outOfLives || win) {
      showToast(t('game.hintFailToast'));
      return false;
    }
    const candidates = hintCandidates(levelIndex);
    const pick = boardRef.current?.pickVisible(candidates) ?? candidates[0];
    const outcome = pick === undefined || pick < 0 ? null : giveHint(levelIndex, pick);
    if (!outcome) {
      showToast(t('game.hintFailToast'));
      return false;
    }
    boardRef.current?.play(outcome, { hint: true });
    posthog?.capture('puzzle_hint_requested', { game_id: 'arrows', level_index: levelIndex + 1 });
    return true;
  }

  const { hintCount, onHintPress } = useHintGate(attemptHint, () => showToast(tc('actions.hintAdNotReady')));

  function replayTutorial() {
    navigation.navigate('ArrowsTutorial', { tutorialKey: 'all', pendingLevelIndex: levelIndex });
  }

  function nextLevel() {
    navigation.replace('ArrowsGame', { levelIndex: levelIndex + 1 });
  }

  const { requestSkip, isAdReady: isSkipAdReady } = useRewardedSkip(() => {
    markLevelSkipped(levelIndex);
    posthog?.capture('puzzle_level_skipped', { game_id: 'arrows', level_index: levelIndex + 1 });
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

  // Boards are generated in the background (time-sliced); a cold start on a
  // big tier can take a moment before the first one lands.
  if (!level) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgDeep, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={accent} />
      </SafeAreaView>
    );
  }

  return (
    <GameScreenLayout
      onBack={() => navigation.popTo('ArrowsHub')}
      backAccessibilityLabel={tc('actions.backToHub')}
      eyebrow={tc(`difficulty.tiers.${level.tier}`).toUpperCase()}
      title={t('game.levelTitle', { number: levelIndex + 1 })}
      headerRight={
        <>
          <IconButton name="help" onPress={replayTutorial} accessibilityLabel={tc('actions.replayTutorial')} />
          <IconButton name="refresh-outline" onPress={onResetPress} accessibilityLabel={tc('actions.resetLevel')} />
        </>
      }
      controls={
        <View style={{ flexDirection: 'row', gap: 20, justifyContent: 'center' }}>
          <GameActionButton.Hint onPress={onHintPress} accentColor={accent} hintCount={hintCount} />
          {!revealWin && <GameActionButton.Skip onPress={onSkipPress} accentColor={accent} />}
        </View>
      }
      winOverlay={
        <>
          <WinOverlay
            visible={revealWin}
            badge="🎯"
            showConfetti={showConfetti}
            confettiPalette={confettiPalette}
            title={t('game.winTitle')}
            subtitle={t('game.winSubtitle')}
            nextLabel={tc('actions.nextLevel')}
            onNext={nextLevel}
            unlockedTier={difficulty.hasNewUnlock ? difficulty.unlockedTier : null}
            onUnlockSeen={difficulty.markUnlockSeen}
          />
          <LevelFailedOverlay
            visible={outOfLives}
            badge="💔"
            title={t('game.failTitle')}
            subtitle={t('game.failSubtitle')}
            retryLabel={t('game.retry')}
            onRetry={onRetry}
          />
        </>
      }
    >
      <LivesBar livesLeft={board.livesLeft} maxLives={MAX_LIVES} />
      <ArrowsBoard
        ref={boardRef}
        level={level}
        removed={board.removed}
        disabled={win || outOfLives}
        onTapArrow={onTapArrow}
        onBumpImpact={onBumpImpact}
        celebrate={celebrate}
        onCelebrationDone={handleCelebrationDone}
      />
    </GameScreenLayout>
  );
}
