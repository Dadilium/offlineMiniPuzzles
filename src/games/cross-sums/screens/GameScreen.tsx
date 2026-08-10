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
import { colors } from '../../../theme/colors';
import { posthog } from '../../../config/posthog';
import { useHintGate } from '../../../ads/useHintGate';
import { useInterstitialOnComplete } from '../../../ads/useInterstitialOnComplete';
import { useRewardedSkip } from '../../../ads/useRewardedSkip';
import CrossSumsGrid, { waveDurationMs } from '../components/CrossSumsGrid';
import ToolToggle from '../components/ToolToggle';
import { ACCENT_PALETTE } from '../components/TutorialDiagram';
import { computeSums, computeWin, type Tool } from '../engine';
import type { CrossSumsStackParamList } from '../navigation';
import { useCrossSumsProgress } from '../state/useCrossSumsProgress';

type Props = NativeStackScreenProps<CrossSumsStackParamList, 'CrossSumsGame'>;

const EMPTY_SUMS = { rowSums: [] as number[], colSums: [] as number[] };
const EMPTY_HINTED = new Set<string>();

export default function GameScreen({ route, navigation }: Props) {
  const { levelIndex } = route.params;
  const {
    levelFor,
    ensureLevel,
    marksByLevel,
    hintedCellsByLevel,
    toggleCellAt,
    giveHint,
    resetLevel,
    markLevelComplete,
    markLevelSkipped,
    levelsCompleted,
  } = useCrossSumsProgress();
  const { showToast } = useToast();
  const { t } = useTranslation('cross-sums');
  const { t: tc } = useTranslation('common');
  const [tool, setTool] = useState<Tool>('pen');

  // Levels are generated on demand, not bundled -- ensureLevel triggers that
  // generation (and persists the result) as a side effect, never during
  // render. Generation is essentially instant at these sizes (see the
  // checkpoint sweep), but the next level is still prefetched the moment
  // this one opens, same pattern as every other game here.
  useEffect(() => {
    ensureLevel(levelIndex);
    InteractionManager.runAfterInteractions(() => ensureLevel(levelIndex + 1));
  }, [levelIndex, ensureLevel]);

  const level = levelFor(levelIndex);
  const marks = level ? marksByLevel[levelIndex] : undefined;
  const hintedCells = hintedCellsByLevel[levelIndex] ?? EMPTY_HINTED;

  const sums = useMemo(() => (level && marks ? computeSums(level.grid, marks) : EMPTY_SUMS), [level, marks]);
  const win = useMemo(() => (level && marks ? computeWin(level, marks) : false), [level, marks]);

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

  const { notifyLevelCompleted } = useInterstitialOnComplete('cross-sums');

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
    if (!level || !marks) return;
    if (!win) return;
    if (celebratedForLevel.current === levelIndex) return;
    celebratedForLevel.current = levelIndex;

    markLevelComplete(levelIndex);
    posthog?.capture('puzzle_level_completed', { game_id: 'cross_sums', level_index: levelIndex + 1 });
    setCelebrate(true);
    const waveMs = waveDurationMs(level.rows, level.cols);
    const revealTimer = setTimeout(() => {
      setRevealWin(true);
      setShowConfetti(true);
      notifyLevelCompleted();
    }, waveMs);
    const confettiTimer = setTimeout(() => setShowConfetti(false), waveMs + 1300);
    return () => {
      clearTimeout(revealTimer);
      clearTimeout(confettiTimer);
    };
    // notifyLevelCompleted deliberately excluded -- its identity changes
    // whenever the interstitial ad hook's loaded state changes, which would
    // re-run this effect, cancel the pending reveal timer in cleanup, and
    // then the celebratedForLevel guard above would block it from ever
    // rescheduling -- leaving the wave played but the win popup never shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win, level, marks, levelIndex, markLevelComplete]);

  function onCellPress(r: number, c: number) {
    toggleCellAt(levelIndex, r, c, tool);
  }

  function onResetPress() {
    resetCelebration();
    resetLevel(levelIndex);
  }

  function attemptHint(): boolean {
    const gaveHint = giveHint(levelIndex);
    if (gaveHint) posthog?.capture('puzzle_hint_requested', { game_id: 'cross_sums', level_index: levelIndex + 1 });
    else showToast(t('game.hintFailToast'));
    return gaveHint;
  }

  const { hintCount, onHintPress } = useHintGate(attemptHint, () => showToast(tc('actions.hintAdNotReady')));

  function replayTutorial() {
    navigation.navigate('CrossSumsTutorial', { tutorialKey: 'all', pendingLevelIndex: levelIndex });
  }

  function nextLevel() {
    navigation.replace('CrossSumsGame', { levelIndex: levelIndex + 1 });
  }

  const { requestSkip, isAdReady: isSkipAdReady } = useRewardedSkip(() => {
    markLevelSkipped(levelIndex);
    posthog?.capture('puzzle_level_skipped', { game_id: 'cross_sums', level_index: levelIndex + 1 });
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

  if (!level || !marks) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgDeep }} />;
  }

  return (
    <GameScreenLayout
      onBack={() => navigation.popTo('CrossSumsHub')}
      backAccessibilityLabel={tc('actions.backToHub')}
      title={level.title ?? t('game.levelTitle', { number: levelIndex + 1 })}
      headerRight={
        <>
          <IconButton name="help" onPress={replayTutorial} accessibilityLabel={tc('actions.replayTutorial')} />
          <IconButton name="refresh-outline" onPress={onResetPress} accessibilityLabel={tc('actions.resetLevel')} />
        </>
      }
      controls={
        <View style={{ flexDirection: 'row', gap: 20, justifyContent: 'center' }}>
          <GameActionButton.Hint onPress={onHintPress} accentColor={colors.success} hintCount={hintCount} />
          {!revealWin && <GameActionButton.Skip onPress={onSkipPress} accentColor={colors.success} />}
        </View>
      }
      winOverlay={
        <WinOverlay
          visible={revealWin}
          badge="👑"
          showConfetti={showConfetti}
          confettiPalette={ACCENT_PALETTE}
          title={t('game.winTitle')}
          subtitle={t('game.winSubtitle')}
          nextLabel={tc('actions.nextLevel')}
          onNext={nextLevel}
        />
      }
    >
      <View style={{ alignItems: 'center' }}>
        <ToolToggle tool={tool} onChange={setTool} penLabel={t('tools.pen')} eraserLabel={t('tools.eraser')} />
        <CrossSumsGrid
          level={level}
          marks={marks}
          hintedCells={hintedCells}
          rowSums={sums.rowSums}
          colSums={sums.colSums}
          celebrate={celebrate}
          onCellPress={onCellPress}
        />
      </View>
    </GameScreenLayout>
  );
}
