import React, { useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, StyleSheet, View } from 'react-native';
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
import { useInterstitialOnComplete } from '../../../ads/useInterstitialOnComplete';
import { useRewardedSkip } from '../../../ads/useRewardedSkip';
import FindWordsGrid from '../components/FindWordsGrid';
import WordList from '../components/WordList';
import { isLevelComplete } from '../engine';
import type { FindWordsStackParamList } from '../navigation';
import { useFindWordsProgress } from '../state/useFindWordsProgress';
import type { Cell, FindWordsPlayerState } from '../types';

type Props = NativeStackScreenProps<FindWordsStackParamList, 'FindWordsGame'>;

const EMPTY_FOUND: FindWordsPlayerState = [];

export default function GameScreen({ route, navigation }: Props) {
  const { levelIndex } = route.params;
  const { colors } = useTheme();
  const confettiPalette = useMemo(
    () => [colors.teal, colors.signalBlue, colors.warn, colors.purple, colors.cyan, colors.gold],
    [colors]
  );
  const {
    levelFor,
    ensureLevel,
    foundIndicesByLevel,
    attemptWord,
    giveHint,
    resetLevel,
    markLevelComplete,
    markLevelSkipped,
    levelsCompleted,
  } = useFindWordsProgress();
  const { showToast } = useToast();
  const { t } = useTranslation('find-words');
  const { t: tc } = useTranslation('common');

  // Levels are generated on demand, not bundled -- ensureLevel triggers that
  // generation (and persists the result) as a side effect, never during
  // render. The next level is prefetched the moment this one opens, same
  // pattern as every other game here.
  useEffect(() => {
    ensureLevel(levelIndex);
    InteractionManager.runAfterInteractions(() => ensureLevel(levelIndex + 1));
  }, [levelIndex, ensureLevel]);

  const level = levelFor(levelIndex);
  const foundIndices = level ? (foundIndicesByLevel[levelIndex] ?? EMPTY_FOUND) : EMPTY_FOUND;

  const win = useMemo(() => (level ? isLevelComplete(foundIndices, level) : false), [level, foundIndices]);

  const [celebrate, setCelebrate] = useState(false);
  const [revealWin, setRevealWin] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Guards the win effect below against re-firing -- see ShikakuGrid's
  // GameScreen for why this is a ref keyed on levelIndex rather than a
  // dependency on `levelsCompleted` itself.
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

  const { notifyLevelCompleted } = useInterstitialOnComplete('find-words');

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

  // On solve: play the diagonal-wave bounce across every found word's
  // capsule first, then reveal the win overlay/confetti only once
  // `FindWordsGrid` reports the wave has actually finished animating
  // (`handleCelebrationDone`) -- not a guessed duration, so the popup can
  // never cut the celebration off.
  useEffect(() => {
    if (!level) return;
    if (!win) return;
    if (celebratedForLevel.current === levelIndex) return;
    celebratedForLevel.current = levelIndex;

    markLevelComplete(levelIndex);
    posthog?.capture('puzzle_level_completed', { game_id: 'find-words', level_index: levelIndex + 1 });
    setCelebrate(true);
  }, [win, level, levelIndex, markLevelComplete]);

  function handleCelebrationDone() {
    setRevealWin(true);
    setShowConfetti(true);
    notifyLevelCompleted();
    clearConfettiTimer();
    confettiTimerRef.current = setTimeout(() => setShowConfetti(false), 1300);
  }

  function onAttemptSelection(cells: Cell[]): number | null {
    return attemptWord(levelIndex, cells);
  }

  function onResetPress() {
    resetCelebration();
    resetLevel(levelIndex);
  }

  function replayTutorial() {
    navigation.navigate('FindWordsTutorial', { tutorialKey: 'all', pendingLevelIndex: levelIndex });
  }

  function nextLevel() {
    navigation.replace('FindWordsGame', { levelIndex: levelIndex + 1 });
  }

  const { requestSkip, isAdReady: isSkipAdReady } = useRewardedSkip(() => {
    markLevelSkipped(levelIndex);
    posthog?.capture('puzzle_level_skipped', { game_id: 'find-words', level_index: levelIndex + 1 });
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

  function attemptHint(): boolean {
    const gaveHint = giveHint(levelIndex);
    if (gaveHint) posthog?.capture('puzzle_hint_requested', { game_id: 'find-words', level_index: levelIndex + 1 });
    return gaveHint;
  }

  const { hintCount, onHintPress } = useHintGate(attemptHint, () => showToast(tc('actions.hintAdNotReady')));

  if (!level) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgDeep }} />;
  }

  return (
    <GameScreenLayout
      onBack={() => navigation.popTo('FindWordsHub')}
      backAccessibilityLabel={tc('actions.backToHub')}
      title={t('game.levelTitle', { number: levelIndex + 1 })}
      headerRight={
        <>
          <IconButton name="help" onPress={replayTutorial} accessibilityLabel={tc('actions.replayTutorial')} />
          <IconButton name="refresh-outline" onPress={onResetPress} accessibilityLabel={tc('actions.resetLevel')} />
        </>
      }
      boardScrollable
      controls={
        <View style={{ flexDirection: 'row', gap: 20, justifyContent: 'center' }}>
          <GameActionButton.Hint onPress={onHintPress} accentColor={colors.teal} hintCount={hintCount} />
          {!revealWin && <GameActionButton.Skip onPress={onSkipPress} accentColor={colors.teal} />}
        </View>
      }
      winOverlay={
        <WinOverlay
          visible={revealWin}
          badge="🔎"
          showConfetti={showConfetti}
          confettiPalette={confettiPalette}
          title={t('game.winTitle')}
          subtitle={t('game.winSubtitle')}
          nextLabel={tc('actions.nextLevel')}
          onNext={nextLevel}
        />
      }
    >
      <View style={styles.content}>
        <FindWordsGrid
          level={level}
          foundIndices={foundIndices}
          celebrate={celebrate}
          onCelebrationDone={handleCelebrationDone}
          onAttemptSelection={onAttemptSelection}
        />
        <WordList placements={level.placements} foundIndices={foundIndices} />
      </View>
    </GameScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', gap: 18 },
});
