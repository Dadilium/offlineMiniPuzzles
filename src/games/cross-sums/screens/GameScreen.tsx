import React, { useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import IconButton from '../../../components/IconButton';
import TopBar from '../../../components/TopBar';
import { useToast } from '../../../components/Toast';
import { colors, fonts, radii } from '../../../theme/colors';
import CrossSumsGrid, { waveDurationMs } from '../components/CrossSumsGrid';
import WinOverlay from '../components/WinOverlay';
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
    if (!gaveHint) showToast('Every cell is already right where it should be.');
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
    return <SafeAreaView style={styles.screen} />;
  }

  return (
    <SafeAreaView style={styles.screen}>
      <TopBar
        onBack={() => navigation.navigate('CrossSumsHub')}
        backAccessibilityLabel="Back to hub"
        eyebrow={`LEVEL ${levelIndex + 1}`}
        title={level.title ?? `Level ${levelIndex + 1}`}
        right={
          <>
            <IconButton glyph="?" onPress={replayTutorial} accessibilityLabel="Replay the tutorial" />
            <IconButton glyph="⟲" onPress={onResetPress} accessibilityLabel="Reset level" size={40} glyphSize={19} />
          </>
        }
      />

      <View style={styles.statusRow}>
        <Text style={[styles.statusPill, { color: rowsMatched === level.rows ? colors.success : colors.textDim }]}>
          Rows {rowsMatched}/{level.rows}
        </Text>
        <Text style={[styles.statusPill, { color: colsMatched === level.cols ? colors.success : colors.textDim }]}>
          Cols {colsMatched}/{level.cols}
        </Text>
      </View>

      <View style={styles.boardArea}>
        <CrossSumsGrid
          level={level}
          mask={mask}
          hintedCells={hintedCells}
          rowSums={sums.rowSums}
          colSums={sums.colSums}
          celebrate={celebrate}
          onCellPress={onCellPress}
        />
      </View>

      <Text style={styles.legend}>tap a number to cross it out · tap again to keep it · edges show each target</Text>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.hintBtn} activeOpacity={0.75} onPress={onHintPress}>
          <Text style={styles.hintBtnText}>Hint</Text>
        </TouchableOpacity>
        {!revealWin && (
          <TouchableOpacity style={styles.skipBtn} activeOpacity={0.75} onPress={onSkipPress}>
            <Text style={styles.skipBtnText}>Skip level (watch an ad)</Text>
          </TouchableOpacity>
        )}
      </View>

      <WinOverlay
        visible={revealWin}
        showConfetti={showConfetti}
        subtitle="Every row and column landed on target — next board unlocked."
        nextLabel="Next level"
        onNext={nextLevel}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDeep },
  statusRow: { flexDirection: 'row', gap: 14, flexWrap: 'wrap', paddingHorizontal: 18, paddingTop: 8, justifyContent: 'center' },
  statusPill: { fontSize: 11.5, fontWeight: '600', fontFamily: fonts.mono },
  // Takes up all remaining vertical space between the status row and the
  // bottom controls, so the board is always centered and Hint always sits
  // at the very bottom of the screen -- regardless of board size (4x4 to 8x8).
  boardArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  legend: {
    fontSize: 10.5,
    color: colors.textFaint,
    paddingHorizontal: 18,
    textAlign: 'center',
    fontFamily: fonts.mono,
    lineHeight: 16,
  },
  controls: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 6, gap: 8 },
  hintBtn: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingVertical: 13, alignItems: 'center' },
  hintBtnText: { color: colors.text, fontWeight: '600', fontSize: 14 },
  skipBtn: { paddingVertical: 8, alignItems: 'center' },
  skipBtnText: { color: colors.textFaint, fontWeight: '600', fontSize: 12 },
});
