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
import { useInterstitialOnAction, useInterstitialOnComplete } from '../../../ads/useInterstitialOnComplete';
import { useRewardedSkip } from '../../../ads/useRewardedSkip';
import { MATCHING_NUMBERS_ADD_NUMBERS_AD_SCHEDULE } from '../../../config/ads';
import MatchingNumbersGrid, { ROW_COLLAPSE_MS, type PendingMatch } from '../components/MatchingNumbersGrid';
import FailOverlay from '../components/FailOverlay';
import { attemptMatch, computeWin, findFullyEmptyRow, hasLegalMove, MAX_ADD_NUMBERS } from '../engine';
import type { MatchingNumbersStackParamList } from '../navigation';
import { useMatchingNumbersProgress } from '../state/useMatchingNumbersProgress';
import type { Cell } from '../types';

type Props = NativeStackScreenProps<MatchingNumbersStackParamList, 'MatchingNumbersGame'>;

const CONFETTI_PALETTE = [colors.purple, colors.gold, colors.cyan, colors.pink, colors.success, colors.signalBlue];
/** A level that takes this long forces the level-completion interstitial due, regardless of the count-based schedule. */
const SLOW_LEVEL_MS = 2 * 60 * 1000;

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
    collapseRow,
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
  // Board area's rendered height -- lets the grid pad itself out with
  // placeholder rows so it always visually fills the screen, regardless of
  // how few rows a given difficulty actually needs.
  const [boardAreaHeight, setBoardAreaHeight] = useState(0);
  // Row index Add Numbers most recently appended from -- lets the grid
  // stagger those new cells' entrance instead of popping them all in at once.
  const [appearFromRow, setAppearFromRow] = useState<number | null>(null);
  // Row index currently mid shift-up collapse (see engine.findFullyEmptyRow),
  // if any -- board is only mutated (removeRow, via collapseRow) once that
  // row's collapse animation has actually finished playing.
  const [collapsingRow, setCollapsingRow] = useState<number | null>(null);
  // Backs the collapse timer below -- kept in a ref (not just the setTimeout
  // return value local to the effect) so it survives re-renders without
  // being torn down by React's own effect-cleanup mechanism. See that effect
  // for why that distinction matters.
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Wall-clock time this level attempt began -- reset on level change and on
  // retry, so it always reflects the current attempt, not cumulative time
  // across retries. Used to force the level-completion interstitial due when
  // a level takes unusually long to solve (see SLOW_LEVEL_MS).
  const levelStartRef = useRef(Date.now());
  useEffect(() => {
    setAppearFromRow(null);
    setCollapsingRow(null);
    levelStartRef.current = Date.now();
  }, [levelIndex]);

  // Deliberately does NOT return a cleanup that clears the timer -- this
  // effect re-runs on every `board` change (e.g. an unrelated match clearing
  // cells elsewhere while this row's collapse is still counting down), and a
  // cleanup tied to that would cancel the in-flight timer before it ever
  // calls collapseRow, permanently orphaning `collapsingRow` (stuck non-null
  // forever, since nothing else resets it) -- no row ever collapses again for
  // the rest of the level, and every future match's line/highlight math goes
  // stale against the frozen-but-never-applied visual shift. The `board ||
  // collapsingRow != null` guard below is what actually prevents double-
  // scheduling, not the cleanup.
  useEffect(() => {
    if (!board || collapsingRow != null) return;
    const emptyRow = findFullyEmptyRow(board);
    if (emptyRow == null) return;
    setCollapsingRow(emptyRow);
    collapseTimerRef.current = setTimeout(() => {
      collapseTimerRef.current = null;
      collapseRow(levelIndex, emptyRow);
      setCollapsingRow(null);
    }, ROW_COLLAPSE_MS);
  }, [board, collapsingRow, levelIndex, collapseRow]);

  // Unmount/level-switch safety net only -- clears any still-pending timer so
  // it can't fire collapseRow/setCollapsingRow against a screen that's gone
  // or has since moved on to a different level.
  useEffect(() => {
    return () => {
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    };
  }, [levelIndex]);

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

  const { notifyLevelCompleted } = useInterstitialOnComplete('matching-numbers');

  const [showConfetti, setShowConfetti] = useState(false);
  useEffect(() => {
    if (!board) return;
    if (win && !levelsCompleted.has(levelIndex)) {
      markLevelComplete(levelIndex);
      posthog?.capture('puzzle_level_completed', { game_id: 'matching_numbers', level_index: levelIndex + 1 });
      setShowConfetti(true);
      const tookLong = Date.now() - levelStartRef.current >= SLOW_LEVEL_MS;
      notifyLevelCompleted({ forceDue: tookLong });
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
    // Also blocked during collapsingRow: a match started now would capture
    // (r, c) coordinates that go stale the instant this row's collapse
    // actually removes a row and shifts everything below it up by one --
    // see the collapse effect above for the full story.
    if (!board || pendingMatch || rejectedPair || collapsingRow != null) return;
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

  function attemptHint(): boolean {
    const pair = giveHint(levelIndex);
    if (!pair) {
      showToast(t('game.hintFailToast'));
      return false;
    }
    posthog?.capture('puzzle_hint_requested', { game_id: 'matching_numbers', level_index: levelIndex + 1 });
    if (hintTimer.current) clearTimeout(hintTimer.current);
    setHintPair(pair);
    hintTimer.current = setTimeout(() => setHintPair(null), 1500);
    return true;
  }

  const { hintCount, onHintPress } = useHintGate(attemptHint, () => showToast(tc('actions.hintAdNotReady')));

  const { notifyAction: notifyAddNumbersUsed } = useInterstitialOnAction(
    'matching-numbers',
    'add-numbers',
    MATCHING_NUMBERS_ADD_NUMBERS_AD_SCHEDULE
  );

  function onAddNumbersPress() {
    const prevRows = board.length;
    const ok = addNumbers(levelIndex);
    if (!ok) {
      showToast(t('game.addNumbersFailToast'));
      return;
    }
    setAppearFromRow(prevRows);
    notifyAddNumbersUsed();
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
    setAppearFromRow(null);
    setCollapsingRow(null);
    levelStartRef.current = Date.now();
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
          <IconButton name="help" onPress={replayTutorial} accessibilityLabel={tc('actions.replayTutorial')} />
          <IconButton name="refresh-outline" onPress={onRetryPress} accessibilityLabel={tc('actions.resetLevel')} />
        </>
      }
      boardScrollable
      onBoardAreaLayout={setBoardAreaHeight}
      controls={
        <>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <GameActionButton label={tc('actions.hintWithCount', { count: hintCount })} onPress={onHintPress} style={{ flex: 1 }} />
            <GameActionButton
              label={t('game.addNumbersActionWithCount', { count: addNumbersRemaining })}
              onPress={onAddNumbersPress}
              style={{ flex: 1 }}
            />
          </View>
          {!win && <GameActionButton label={tc('actions.skipLevelAd')} onPress={onSkipPress} variant="ghost" />}
        </>
      }
      winOverlay={
        <>
          <WinOverlay
            visible={win}
            badge="👑"
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
        availableHeight={boardAreaHeight}
        appearFromRow={appearFromRow}
        collapsingRow={collapsingRow}
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
