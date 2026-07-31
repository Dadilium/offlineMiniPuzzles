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
import CrossSumsGrid, { waveDurationMs } from '../components/CrossSumsGrid';
import { ACCENT_PALETTE } from '../components/TutorialDiagram';
import { computeSums, computeWin } from '../engine';
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
    masksByLevel,
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
  const mask = level ? masksByLevel[levelIndex] : undefined;
  const hintedCells = hintedCellsByLevel[levelIndex] ?? EMPTY_HINTED;

  const sums = useMemo(() => (level && mask ? computeSums(level.grid, mask) : EMPTY_SUMS), [level, mask]);
  const win = useMemo(() => (level && mask ? computeWin(level, mask) : false), [level, mask]);
  const rowsMatched = level ? sums.rowSums.filter((sum, r) => sum === level.rowTargets[r]).length : 0;
  const colsMatched = level ? sums.colSums.filter((sum, c) => sum === level.colTargets[c]).length : 0;

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
    if (!level || !mask) return;
    if (!win) return;
    if (celebratedForLevel.current === levelIndex) return;
    celebratedForLevel.current = levelIndex;

    markLevelComplete(levelIndex);
    setCelebrate(true);
    const waveMs = waveDurationMs(level.rows, level.cols);
    const revealTimer = setTimeout(() => {
      setRevealWin(true);
      setShowConfetti(true);
    }, waveMs);
    const confettiTimer = setTimeout(() => setShowConfetti(false), waveMs + 1300);
    return () => {
      clearTimeout(revealTimer);
      clearTimeout(confettiTimer);
    };
  }, [win, level, mask, levelIndex, markLevelComplete]);

  function onCellPress(r: number, c: number) {
    toggleCellAt(levelIndex, r, c);
  }

  function onResetPress() {
    resetCelebration();
    resetLevel(levelIndex);
  }

  function onHintPress() {
    const gaveHint = giveHint(levelIndex);
    if (!gaveHint) showToast(t('game.hintFailToast'));
  }

  function replayTutorial() {
    navigation.navigate('CrossSumsTutorial', { tutorialKey: 'all', pendingLevelIndex: levelIndex });
  }

  function nextLevel() {
    navigation.replace('CrossSumsGame', { levelIndex: levelIndex + 1 });
  }

  function onSkipPress() {
    if (win) return;
    markLevelSkipped(levelIndex);
    ensureLevel(levelIndex + 1);
    nextLevel();
  }

  if (!level || !mask) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgDeep }} />;
  }

  return (
    <GameScreenLayout
      onBack={() => navigation.navigate('CrossSumsHub')}
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
          confettiPalette={ACCENT_PALETTE}
          title={t('game.winTitle')}
          subtitle={t('game.winSubtitle')}
          nextLabel={tc('actions.nextLevel')}
          onNext={nextLevel}
        />
      }
    >
      <CrossSumsGrid
        level={level}
        mask={mask}
        hintedCells={hintedCells}
        rowSums={sums.rowSums}
        colSums={sums.colSums}
        celebrate={celebrate}
        onCellPress={onCellPress}
      />
    </GameScreenLayout>
  );
}
