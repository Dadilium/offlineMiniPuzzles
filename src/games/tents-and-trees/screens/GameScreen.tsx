import React, { useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, SafeAreaView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import GameActionButton from '../../../components/GameActionButton';
import GameScreenLayout from '../../../components/GameScreenLayout';
import IconButton from '../../../components/IconButton';
import StatusPill from '../../../components/StatusPill';
import { useToast } from '../../../components/Toast';
import WinOverlay from '../../../components/WinOverlay';
import { colors } from '../../../theme/colors';
import { posthog } from '../../../config/posthog';
import { useInterstitialOnComplete } from '../../../ads/useInterstitialOnComplete';
import { useRewardedSkip } from '../../../ads/useRewardedSkip';
import TentsAndTreesGrid, { waveDurationMs } from '../components/TentsAndTreesGrid';
import { computeCounts, computeWin } from '../engine';
import type { TentsAndTreesStackParamList } from '../navigation';
import { useTentsAndTreesProgress } from '../state/useTentsAndTreesProgress';

type Props = NativeStackScreenProps<TentsAndTreesStackParamList, 'TentsAndTreesGame'>;

const EMPTY_COUNTS = { rowCounts: [] as number[], colCounts: [] as number[] };
const EMPTY_HINTED = new Set<string>();
const CONFETTI_PALETTE = [colors.success, colors.signalBlue, colors.warn, colors.purple, colors.cyan, colors.gold];

export default function GameScreen({ route, navigation }: Props) {
  const { levelIndex } = route.params;
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
  } = useTentsAndTreesProgress();
  const { showToast } = useToast();
  const { t } = useTranslation('tents-and-trees');
  const { t: tc } = useTranslation('common');

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
  const tents = level ? tentsByLevel[levelIndex] : undefined;
  const hintedCells = hintedCellsByLevel[levelIndex] ?? EMPTY_HINTED;

  const counts = useMemo(() => (level && tents ? computeCounts(tents) : EMPTY_COUNTS), [level, tents]);
  const win = useMemo(() => (level && tents ? computeWin(level, tents) : false), [level, tents]);
  const rowsMatched = level ? counts.rowCounts.filter((count, r) => count === level.rowTargets[r]).length : 0;
  const colsMatched = level ? counts.colCounts.filter((count, c) => count === level.colTargets[c]).length : 0;

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

    markLevelComplete(levelIndex);
    posthog?.capture('puzzle_level_completed', { game_id: 'tents_and_trees', level_index: levelIndex + 1 });
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
  }, [win, level, tents, levelIndex, markLevelComplete, notifyLevelCompleted]);

  function onCellPress(r: number, c: number) {
    toggleTentAt(levelIndex, r, c);
  }

  function onResetPress() {
    resetCelebration();
    resetLevel(levelIndex);
  }

  function onHintPress() {
    const gaveHint = giveHint(levelIndex);
    if (gaveHint) posthog?.capture('puzzle_hint_requested', { game_id: 'tents_and_trees', level_index: levelIndex + 1 });
    if (!gaveHint) showToast(t('game.hintFailToast'));
  }

  function replayTutorial() {
    navigation.navigate('TentsAndTreesTutorial', { tutorialKey: 'all', pendingLevelIndex: levelIndex });
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
    return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgDeep }} />;
  }

  return (
    <GameScreenLayout
      onBack={() => navigation.navigate('TentsAndTreesHub')}
      backAccessibilityLabel={tc('actions.backToHub')}
      title={level.title ?? t('game.levelTitle', { number: levelIndex + 1 })}
      headerRight={
        <>
          <IconButton glyph="?" onPress={replayTutorial} accessibilityLabel={tc('actions.replayTutorial')} />
          <IconButton glyph="⟲" onPress={onResetPress} accessibilityLabel={tc('actions.resetLevel')} size={40} glyphSize={19} />
        </>
      }
      statusRow={
        <>
          <StatusPill color={rowsMatched === level.rows ? colors.success : colors.textDim}>
            {t('game.statusRows', { count: rowsMatched, total: level.rows })}
          </StatusPill>
          <StatusPill color={colsMatched === level.cols ? colors.success : colors.textDim}>
            {t('game.statusCols', { count: colsMatched, total: level.cols })}
          </StatusPill>
        </>
      }
      legend={t('game.legend')}
      controls={
        <>
          <GameActionButton label={tc('actions.hint')} onPress={onHintPress} />
          {!revealWin && <GameActionButton label={tc('actions.skipLevelAd')} onPress={onSkipPress} variant="ghost" />}
        </>
      }
      winOverlay={
        <WinOverlay
          visible={revealWin}
          badge="✅"
          showConfetti={showConfetti}
          confettiPalette={CONFETTI_PALETTE}
          title={t('game.winTitle')}
          subtitle={t('game.winSubtitle')}
          nextLabel={tc('actions.nextLevel')}
          onNext={nextLevel}
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
