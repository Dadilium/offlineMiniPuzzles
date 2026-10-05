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
import { useInterstitialAtLevelStart, useInterstitialOnAction, useInterstitialOnComplete } from '../../../ads/useInterstitialOnComplete';
import { useRewardedSkip } from '../../../ads/useRewardedSkip';
import { MATCHING_NUMBERS_ADD_NUMBERS_AD_SCHEDULE } from '../../../config/ads';
import DailyLoading from '../../../daily/DailyLoading';
import { useExitToOrigin } from '../../../daily/navigation';
import { useDailySession } from '../../../daily/useDailySession';
import MatchingNumbersGrid, { type PendingMatch } from '../components/MatchingNumbersGrid';
import FailOverlay from '../components/FailOverlay';
import { attemptMatch, computeWin, findFullyEmptyRows, hasLegalMove, MAX_ADD_NUMBERS } from '../engine';
import type { MatchingNumbersStackParamList } from '../navigation';
import { useMatchingNumbersDailyProgress, useMatchingNumbersProgress } from '../state/useMatchingNumbersProgress';
import type { Cell } from '../types';

type Props = NativeStackScreenProps<MatchingNumbersStackParamList, 'MatchingNumbersGame'>;

/** A level that takes this long forces the level-completion interstitial due, regardless of the count-based schedule. */
const SLOW_LEVEL_MS = 2 * 60 * 1000;

function cellKey(cell: Cell): string {
  return `${cell.r},${cell.c}`;
}

export default function GameScreen({ route, navigation }: Props) {
  // In daily mode `levelIndex` is the day number and everything reads/writes the daily store.
  const { levelIndex, daily } = route.params;
  const exitToOrigin = useExitToOrigin(daily, 'MatchingNumbersHub');
  const regularProgress = useMatchingNumbersProgress();
  const dailyProgress = useMatchingNumbersDailyProgress();
  const {
    levelFor,
    ensureLevel,
    boardsByLevel,
    addNumbersUsedByLevel,
    commitMatch,
    collapseRows,
    addNumbers,
    giveHint,
    resetLevel,
    markLevelComplete,
    markLevelSkipped,
    levelsCompleted,
    difficulty,
  } = daily ? dailyProgress : regularProgress;
  const { showToast } = useToast();
  const { t } = useTranslation('matching-numbers');
  const { t: tc } = useTranslation('common');
  const { colors } = useTheme();
  const confettiPalette = useMemo(
    () => [colors.purple, colors.gold, colors.cyan, colors.pink, colors.success, colors.signalBlue],
    [colors]
  );

  // Levels are generated on demand, not bundled -- ensureLevel triggers that
  // generation (and persists the result) as a side effect. Prefetch the next
  // one the moment this level opens, same rationale as Kings. A daily has no
  // "next" to prefetch -- tomorrow's board is built when tomorrow comes.
  useEffect(() => {
    ensureLevel(levelIndex);
    if (!daily) InteractionManager.runAfterInteractions(() => ensureLevel(levelIndex + 1));
  }, [levelIndex, ensureLevel, daily]);

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
  // Wall-clock time this level attempt began -- reset on level change and on
  // retry, so it always reflects the current attempt, not cumulative time
  // across retries. Used to force the level-completion interstitial due when
  // a level takes unusually long to solve (see SLOW_LEVEL_MS).
  const levelStartRef = useRef(Date.now());
  useEffect(() => {
    levelStartRef.current = Date.now();
  }, [levelIndex]);

  // Stable per-row identity for MatchingNumbersGrid's row keys, independent
  // of the row's current position in `board`. Rows were previously keyed by
  // their plain array index, which reassigns a "new identity" to every
  // surviving row the instant one above it is removed (old row 4 becomes
  // "row 3"). React (and Reanimated's layout/exiting transitions) key
  // identity off that same index, so a collapse never actually looked like
  // "row 2 left, everything else slid up" to them -- it looked like "row 2's
  // *content* silently changed, and the LAST row vanished," which is why the
  // shift/fade animation could land on the wrong rows and visually stack
  // content. These ids are computed fresh each render (not in an effect) so
  // they're ready in time for that same render's row keys:
  // - a fully-empty row's id is spliced out by the collapse effect below, in
  //   the same tick it removes that row from `board` -- every surviving row
  //   keeps its existing id, so Reanimated correctly sees only the removed
  //   row exit and everything else merely reflow.
  // - any other mismatch (board grew via Add Numbers, or was wholly replaced
  //   by a level switch/Retry) means row identity doesn't carry over
  //   meaningfully anyway, so ids are extended or fully reset here.
  const rowIdsRef = useRef<number[]>([]);
  const nextRowIdRef = useRef(0);
  const rowIdsLevelRef = useRef<number | null>(null);
  // Ids of the rows Add Numbers most recently appended, in append order --
  // see MatchingNumbersGrid's `appearRowIds` prop doc for why this rides
  // along with `rowIdsRef` instead of being computed from position. Only
  // overwritten when a fresh batch actually appends (below); reset alongside
  // a full rowIds reset since a wholly different board makes any pending
  // batch meaningless.
  const appearRowIdsRef = useRef<number[]>([]);
  if (rowIdsLevelRef.current !== levelIndex || (board && board.length < rowIdsRef.current.length)) {
    rowIdsRef.current = board ? board.map((_, i) => i) : [];
    nextRowIdRef.current = board ? board.length : 0;
    rowIdsLevelRef.current = levelIndex;
    appearRowIdsRef.current = [];
  } else if (board && board.length > rowIdsRef.current.length) {
    const toAdd = board.length - rowIdsRef.current.length;
    const newIds: number[] = [];
    for (let i = 0; i < toAdd; i++) {
      const id = nextRowIdRef.current++;
      rowIdsRef.current.push(id);
      newIds.push(id);
    }
    appearRowIdsRef.current = newIds;
  }
  const rowIds = rowIdsRef.current;

  // Collapses every fully-emptied row as soon as it's noticed -- no artificial
  // hold. The visual shift/fade is entirely Reanimated's job now (`layout`
  // and `exiting` props in MatchingNumbersGrid, keyed by the stable ids
  // above), decoupled from when the data actually updates, so there's no
  // asynchronous "pending collapse" window left for a fast second tap to land
  // in and capture coordinates that go stale -- see onCellPress/
  // onAddNumbersPress, which no longer need to guard against one.
  useEffect(() => {
    if (!board) return;
    const emptyRows = findFullyEmptyRows(board);
    if (emptyRows.length === 0) return;
    rowIdsRef.current = rowIdsRef.current.filter((_, i) => !emptyRows.includes(i));
    collapseRows(levelIndex, emptyRows);
  }, [board, levelIndex, collapseRows]);

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

  const session = useDailySession({ gameId: 'matching-numbers', dayNumber: daily ? levelIndex : null, ready: !!level && !!board, won: win });

  const { notifyLevelCompleted } = useInterstitialOnComplete('matching-numbers');
  // An ad owed from an earlier win shows here, between levels -- never over
  // the celebration, and never at the start of a daily (its first solve still
  // counts toward the schedule; the ad waits for the next regular level).
  useInterstitialAtLevelStart(level && !daily ? levelIndex : null);

  const [showConfetti, setShowConfetti] = useState(false);
  useEffect(() => {
    if (!board) return;
    if (win && !levelsCompleted.has(levelIndex)) {
      markLevelComplete(levelIndex);
      setShowConfetti(true);
      if (daily) session.recordWin();
      else posthog?.capture('puzzle_level_completed', { game_id: 'matching_numbers', level_index: levelIndex + 1 });
      const tookLong = Date.now() - levelStartRef.current >= SLOW_LEVEL_MS;
      notifyLevelCompleted({ forceDue: tookLong });
      const t = setTimeout(() => setShowConfetti(false), 1300);
      return () => clearTimeout(t);
    }
  }, [win, board, levelIndex, levelsCompleted, markLevelComplete, notifyLevelCompleted, daily, session.recordWin]);

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

  function attemptHint(): boolean {
    const pair = giveHint(levelIndex);
    if (!pair) {
      showToast(t('game.hintFailToast'));
      return false;
    }
    session.noteHint();
    posthog?.capture('puzzle_hint_requested', { game_id: 'matching_numbers', level_index: levelIndex + 1, daily: !!daily });
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
    const ok = addNumbers(levelIndex);
    if (!ok) {
      showToast(t('game.addNumbersFailToast'));
      return;
    }
    // Dailies stay ad-free -- Add Numbers itself still works the same.
    if (!daily) notifyAddNumbersUsed();
  }

  function replayTutorial() {
    navigation.navigate('MatchingNumbersTutorial', { tutorialKey: 'all', pendingLevelIndex: levelIndex, pendingDaily: daily });
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
    // A daily is never skipped -- its only exits are a solve or Done (see FailOverlay below).
    if (win || daily) return;
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
    // Forces the row-ids sync above to treat the next render as a full reset
    // (see its `rowIdsLevelRef.current !== levelIndex` check) rather than
    // reading the pristine board's row count as "growth" -- which it could
    // otherwise look like whenever the board had shrunk (via collapses)
    // below the level's original row count before this Retry.
    rowIdsLevelRef.current = null;
    levelStartRef.current = Date.now();
    resetLevel(levelIndex);
  }

  if (!level || !board) {
    return daily ? <DailyLoading accentColor={colors.purple} onBack={exitToOrigin} /> : <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgDeep }} />;
  }

  const highlightedCells = new Set<string>();
  if (selected) highlightedCells.add(cellKey(selected));
  if (hintPair) {
    highlightedCells.add(cellKey(hintPair[0]));
    highlightedCells.add(cellKey(hintPair[1]));
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
      boardScrollable
      boardAreaAlign="top"
      onBoardAreaLayout={setBoardAreaHeight}
      controls={
        <View style={{ flexDirection: 'row', gap: 20, justifyContent: 'center' }}>
          <GameActionButton.AddNumbers
            onPress={onAddNumbersPress}
            accentColor={colors.purple}
            remaining={addNumbersRemaining}
            caption={t('game.addNumbers')}
            accessibilityLabel={t('game.addNumbersActionWithCount', { count: addNumbersRemaining })}
          />
          <GameActionButton.Hint onPress={onHintPress} accentColor={colors.purple} hintCount={hintCount} />
          {!win && !daily && <GameActionButton.Skip onPress={onSkipPress} accentColor={colors.purple} />}
        </View>
      }
      winOverlay={
        <>
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
          {/* Out of moves on a daily: retry the same board, or Done back to the hub -- never a skip. */}
          <FailOverlay
            visible={showFail}
            title={t('game.failTitle')}
            subtitle={t('game.failSubtitle')}
            retryLabel={t('game.retryLevel')}
            skipLabel={daily ? tc('daily.done') : tc('actions.skipLevelAd')}
            onRetry={onRetryPress}
            onSkip={daily ? exitToOrigin : onSkipPress}
          />
        </>
      }
    >
      <MatchingNumbersGrid
        board={board}
        rowIds={rowIds}
        availableHeight={boardAreaHeight}
        appearRowIds={appearRowIdsRef.current}
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
