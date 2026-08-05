import React, { useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, SafeAreaView, View } from 'react-native';
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
import MatchingNumbersGrid, { type PendingMatch } from '../components/MatchingNumbersGrid';
import FailOverlay from '../components/FailOverlay';
import { attemptMatch, computeWin, hasLegalMove, MAX_ADD_NUMBERS } from '../engine';
import type { MatchingNumbersStackParamList } from '../navigation';
import { useMatchingNumbersProgress } from '../state/useMatchingNumbersProgress';
import type { Cell } from '../types';

type Props = NativeStackScreenProps<MatchingNumbersStackParamList, 'MatchingNumbersGame'>;

const CONFETTI_PALETTE = [colors.purple, colors.gold, colors.cyan, colors.pink, colors.success, colors.signalBlue];

function cellKey(cell: Cell): string {
  return `${cell.r},${cell.c}`;
}

export default function GameScreen({ route, navigation }: Props) {
  const { levelIndex } = route.params;
  const {
    levelFor,
    ensureLevel,
    boardsByLevel,
    addNumbersUsedByLevel,
    commitMatch,
    addNumbers,
    giveHint,
    resetLevel,
    markLevelComplete,
    markLevelSkipped,
    levelsCompleted,
  } = useMatchingNumbersProgress();
  const { showToast } = useToast();
  const { t } = useTranslation('matching-numbers');
  const { t: tc } = useTranslation('common');

  // Levels are generated on demand, not bundled -- ensureLevel triggers that
  // generation (and persists the result) as a side effect. Prefetch the next
  // one the moment this level opens, same rationale as Kings.
  useEffect(() => {
    ensureLevel(levelIndex);
    InteractionManager.runAfterInteractions(() => ensureLevel(levelIndex + 1));
  }, [levelIndex, ensureLevel]);

  const level = levelFor(levelIndex);
  const board = boardsByLevel[levelIndex];

  const [selected, setSelected] = useState<Cell | null>(null);
  const [pendingMatch, setPendingMatch] = useState<PendingMatch | null>(null);
  const [rejectedPair, setRejectedPair] = useState<[Cell, Cell] | null>(null);
  const [hintPair, setHintPair] = useState<[Cell, Cell] | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Boards persist forever, so reopening an already-completed level would
  // otherwise land straight on the cleared board with the win popup showing.
  // Auto-restart it once per mount so there's always a fresh board to play.
  const restartedForLevel = useRef<number | null>(null);
  useEffect(() => {
    if (!level) return;
    if (restartedForLevel.current === levelIndex) return;
    restartedForLevel.current = levelIndex;
    if (levelsCompleted.has(levelIndex)) resetLevel(levelIndex);
  }, [levelIndex, level, levelsCompleted, resetLevel]);

  const win = useMemo(() => (board ? computeWin(board) : false), [board]);
  const stuck = useMemo(() => (board ? !win && !hasLegalMove(board) : false), [board, win]);
  const addNumbersUsed = addNumbersUsedByLevel[levelIndex] ?? 0;
  const addNumbersRemaining = MAX_ADD_NUMBERS - addNumbersUsed;
  const showFail = stuck && addNumbersRemaining <= 0 && !pendingMatch && !rejectedPair;
  const remainingTiles = useMemo(() => (board ? board.flat().filter((v) => v !== null).length : 0), [board]);

  const { notifyLevelCompleted } = useInterstitialOnComplete('matching-numbers');

  const [showConfetti, setShowConfetti] = useState(false);
  useEffect(() => {
    if (!board) return;
    if (win && !levelsCompleted.has(levelIndex)) {
      markLevelComplete(levelIndex);
      posthog?.capture('puzzle_level_completed', { game_id: 'matching_numbers', level_index: levelIndex + 1 });
      setShowConfetti(true);
      notifyLevelCompleted();
      const t = setTimeout(() => setShowConfetti(false), 1300);
      return () => clearTimeout(t);
    }
  }, [win, board, levelIndex, levelsCompleted, markLevelComplete, notifyLevelCompleted]);

  useEffect(() => {
    return () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
    };
  }, []);

  function onCellPress(r: number, c: number) {
    if (!board || pendingMatch || rejectedPair) return;
    if (board[r][c] === null) return;
    if (hintPair) {
      if (hintTimer.current) clearTimeout(hintTimer.current);
      setHintPair(null);
    }

    if (!selected) {
      setSelected({ r, c });
      return;
    }
    if (selected.r === r && selected.c === c) {
      setSelected(null);
      return;
    }

    const target: Cell = { r, c };
    const attempt = attemptMatch(board, selected, target);
    setSelected(null);
    if (attempt.ok && attempt.path) {
      setPendingMatch({ a: selected, b: target, path: attempt.path });
    } else {
      setRejectedPair([selected, target]);
    }
  }

  function onMatchAnimationDone() {
    if (!pendingMatch) return;
    commitMatch(levelIndex, pendingMatch.a, pendingMatch.b);
    setPendingMatch(null);
  }

  function onRejectAnimationDone() {
    setRejectedPair(null);
  }

  function onHintPress() {
    const pair = giveHint(levelIndex);
    if (!pair) {
      showToast(t('game.hintFailToast'));
      return;
    }
    posthog?.capture('puzzle_hint_requested', { game_id: 'matching_numbers', level_index: levelIndex + 1 });
    if (hintTimer.current) clearTimeout(hintTimer.current);
    setHintPair(pair);
    hintTimer.current = setTimeout(() => setHintPair(null), 1500);
  }

  function onAddNumbersPress() {
    const ok = addNumbers(levelIndex);
    if (!ok) showToast(t('game.addNumbersFailToast'));
  }

  function replayTutorial() {
    navigation.navigate('MatchingNumbersTutorial', { tutorialKey: 'all', pendingLevelIndex: levelIndex });
  }

  function nextLevel() {
    navigation.replace('MatchingNumbersGame', { levelIndex: levelIndex + 1 });
  }

  const { requestSkip, isAdReady: isSkipAdReady } = useRewardedSkip(() => {
    markLevelSkipped(levelIndex);
    posthog?.capture('puzzle_level_skipped', { game_id: 'matching_numbers', level_index: levelIndex + 1 });
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

  function onRetryPress() {
    setSelected(null);
    setPendingMatch(null);
    setRejectedPair(null);
    setHintPair(null);
    resetLevel(levelIndex);
  }

  if (!level || !board) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgDeep }} />;
  }

  const highlightedCells = new Set<string>();
  if (selected) highlightedCells.add(cellKey(selected));
  if (hintPair) {
    highlightedCells.add(cellKey(hintPair[0]));
    highlightedCells.add(cellKey(hintPair[1]));
  }

  return (
    <GameScreenLayout
      onBack={() => navigation.navigate('MatchingNumbersHub')}
      backAccessibilityLabel={tc('actions.backToHub')}
      title={level.title ?? t('game.levelTitle', { number: levelIndex + 1 })}
      headerRight={
        <>
          <IconButton glyph="?" onPress={replayTutorial} accessibilityLabel={tc('actions.replayTutorial')} />
          <IconButton
            glyph="⟲"
            onPress={onRetryPress}
            accessibilityLabel={tc('actions.resetLevel')}
            size={40}
            glyphSize={19}
          />
        </>
      }
      statusRow={
        <>
          <StatusPill color={colors.purple}>{t('game.statusTilesLeft', { count: remainingTiles })}</StatusPill>
          <StatusPill color={addNumbersRemaining > 0 ? colors.success : colors.signalRed}>
            {t('game.statusAddNumbers', { count: addNumbersRemaining, total: MAX_ADD_NUMBERS })}
          </StatusPill>
        </>
      }
      boardScrollable
      legend={t('game.legend')}
      controls={
        <>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <GameActionButton label={tc('actions.hint')} onPress={onHintPress} style={{ flex: 1 }} />
            <GameActionButton label={t('game.addNumbersAction')} onPress={onAddNumbersPress} style={{ flex: 1 }} />
          </View>
          {!win && <GameActionButton label={tc('actions.skipLevelAd')} onPress={onSkipPress} variant="ghost" />}
        </>
      }
      winOverlay={
        <>
          <WinOverlay
            visible={win}
            badge="🔢"
            showConfetti={showConfetti}
            confettiPalette={CONFETTI_PALETTE}
            title={t('game.winTitle')}
            subtitle={t('game.winSubtitle')}
            nextLabel={tc('actions.nextLevel')}
            onNext={nextLevel}
          />
          <FailOverlay
            visible={showFail}
            title={t('game.failTitle')}
            subtitle={t('game.failSubtitle')}
            retryLabel={t('game.retryLevel')}
            skipLabel={tc('actions.skipLevelAd')}
            onRetry={onRetryPress}
            onSkip={onSkipPress}
          />
        </>
      }
    >
      <MatchingNumbersGrid
        board={board}
        highlightedCells={highlightedCells}
        pendingMatch={pendingMatch}
        rejectedPair={rejectedPair}
        onCellPress={onCellPress}
        onMatchAnimationDone={onMatchAnimationDone}
        onRejectAnimationDone={onRejectAnimationDone}
      />
    </GameScreenLayout>
  );
}
