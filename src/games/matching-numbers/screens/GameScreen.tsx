import React, { useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import IconButton from '../../../components/IconButton';
import TopBar from '../../../components/TopBar';
import { useToast } from '../../../components/Toast';
import { colors, fonts, radii } from '../../../theme/colors';
import MatchingNumbersGrid, { type PendingMatch } from '../components/MatchingNumbersGrid';
import WinOverlay from '../components/WinOverlay';
import FailOverlay from '../components/FailOverlay';
import { attemptMatch, computeWin, hasLegalMove, MAX_ADD_NUMBERS } from '../engine';
import type { MatchingNumbersStackParamList } from '../navigation';
import { useMatchingNumbersProgress } from '../state/useMatchingNumbersProgress';
import type { Cell } from '../types';

type Props = NativeStackScreenProps<MatchingNumbersStackParamList, 'MatchingNumbersGame'>;

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

  const [showConfetti, setShowConfetti] = useState(false);
  useEffect(() => {
    if (!board) return;
    if (win && !levelsCompleted.has(levelIndex)) {
      markLevelComplete(levelIndex);
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 1300);
      return () => clearTimeout(t);
    }
  }, [win, board, levelIndex, levelsCompleted, markLevelComplete]);

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

  function onSkipPress() {
    if (win) return;
    markLevelSkipped(levelIndex);
    ensureLevel(levelIndex + 1);
    nextLevel();
  }

  function onRetryPress() {
    setSelected(null);
    setPendingMatch(null);
    setRejectedPair(null);
    setHintPair(null);
    resetLevel(levelIndex);
  }

  if (!level || !board) {
    return <SafeAreaView style={styles.screen} />;
  }

  const highlightedCells = new Set<string>();
  if (selected) highlightedCells.add(cellKey(selected));
  if (hintPair) {
    highlightedCells.add(cellKey(hintPair[0]));
    highlightedCells.add(cellKey(hintPair[1]));
  }

  return (
    <SafeAreaView style={styles.screen}>
      <TopBar
        onBack={() => navigation.navigate('MatchingNumbersHub')}
        backAccessibilityLabel={tc('actions.backToHub')}
        eyebrow={t('game.levelEyebrow', { number: levelIndex + 1 })}
        title={level.title ?? t('game.levelTitle', { number: levelIndex + 1 })}
        right={
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
      />

      <View style={styles.statusRow}>
        <Text style={[styles.statusPill, { color: colors.purple }]}>
          {t('game.statusTilesLeft', { count: remainingTiles })}
        </Text>
        <Text style={[styles.statusPill, { color: addNumbersRemaining > 0 ? colors.success : colors.signalRed }]}>
          {t('game.statusAddNumbers', { count: addNumbersRemaining, total: MAX_ADD_NUMBERS })}
        </Text>
      </View>

      <ScrollView style={styles.boardArea} contentContainerStyle={styles.boardAreaContent}>
        <MatchingNumbersGrid
          board={board}
          highlightedCells={highlightedCells}
          pendingMatch={pendingMatch}
          rejectedPair={rejectedPair}
          onCellPress={onCellPress}
          onMatchAnimationDone={onMatchAnimationDone}
          onRejectAnimationDone={onRejectAnimationDone}
        />
      </ScrollView>

      <Text style={styles.legend}>{t('game.legend')}</Text>

      <View style={styles.controls}>
        <View style={styles.controlsRow}>
          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.75} onPress={onHintPress}>
            <Text style={styles.actionBtnText}>{tc('actions.hint')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.75} onPress={onAddNumbersPress}>
            <Text style={styles.actionBtnText}>{t('game.addNumbersAction')}</Text>
          </TouchableOpacity>
        </View>
        {!win && (
          <TouchableOpacity style={styles.skipBtn} activeOpacity={0.75} onPress={onSkipPress}>
            <Text style={styles.skipBtnText}>{tc('actions.skipLevelAd')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <WinOverlay
        visible={win}
        showConfetti={showConfetti}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDeep },
  statusRow: { flexDirection: 'row', gap: 14, flexWrap: 'wrap', paddingHorizontal: 18, paddingTop: 8, justifyContent: 'center' },
  statusPill: { fontSize: 11.5, fontWeight: '600', fontFamily: fonts.mono },
  boardArea: { flex: 1 },
  boardAreaContent: { alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12 },
  legend: {
    fontSize: 10.5,
    color: colors.textFaint,
    paddingHorizontal: 18,
    textAlign: 'center',
    fontFamily: fonts.mono,
    lineHeight: 16,
  },
  controls: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 6, gap: 8 },
  controlsRow: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  actionBtnText: { color: colors.text, fontWeight: '600', fontSize: 14 },
  skipBtn: { paddingVertical: 8, alignItems: 'center' },
  skipBtnText: { color: colors.textFaint, fontWeight: '600', fontSize: 12 },
});
