import React, { useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import IconButton from '../../../components/IconButton';
import TopBar from '../../../components/TopBar';
import { useToast } from '../../../components/Toast';
import { colors, fonts, radii } from '../../../theme/colors';
import ShikakuGrid from '../components/ShikakuGrid';
import WinOverlay from '../components/WinOverlay';
import { computeConflicts, computeWin } from '../engine';
import type { ShikakuStackParamList } from '../navigation';
import { useShikakuProgress } from '../state/useShikakuProgress';
import type { RectBounds, ShikakuPlayerState } from '../types';

type Props = NativeStackScreenProps<ShikakuStackParamList, 'ShikakuGame'>;

const EMPTY_PLACED: ShikakuPlayerState = [];
const EMPTY_HINTED = new Set<number>();
const EMPTY_CONFLICTS = new Set<number>();

export default function GameScreen({ route, navigation }: Props) {
  const { levelIndex } = route.params;
  const {
    levelFor,
    ensureLevel,
    placedByLevel,
    hintedClueIndicesByLevel,
    commitRectAt,
    tapCellAt,
    giveHint,
    resetLevel,
    markLevelComplete,
    markLevelSkipped,
    levelsCompleted,
  } = useShikakuProgress();
  const { showToast } = useToast();

  // Levels are generated on demand, not bundled -- ensureLevel triggers that
  // generation (and persists the result) as a side effect, never during
  // render. The next level is prefetched the moment this one opens, same
  // pattern as every other game here.
  useEffect(() => {
    ensureLevel(levelIndex);
    InteractionManager.runAfterInteractions(() => ensureLevel(levelIndex + 1));
  }, [levelIndex, ensureLevel]);

  const level = levelFor(levelIndex);
  const placed = level ? (placedByLevel[levelIndex] ?? EMPTY_PLACED) : EMPTY_PLACED;
  const hintedClueIndices = hintedClueIndicesByLevel[levelIndex] ?? EMPTY_HINTED;

  const conflicts = useMemo(() => (level ? computeConflicts(level, placed) : EMPTY_CONFLICTS), [level, placed]);
  const win = useMemo(() => (level ? computeWin(level, placed) : false), [level, placed]);
  // "Solved" -- placed AND matching its clue's value, not just placed, so a
  // mismatched-area rectangle doesn't inflate the count (the conflicts pill
  // right next to it already flags it).
  const cluesSolved = level ? placed.filter((rect) => !conflicts.has(rect.clueIndex)).length : 0;

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
  // then reveal the win overlay/confetti only once `ShikakuGrid` reports the
  // wave has actually finished animating (`handleCelebrationDone`) -- not a
  // guessed duration, so the popup can never cut the celebration off.
  useEffect(() => {
    if (!level) return;
    if (!win) return;
    if (celebratedForLevel.current === levelIndex) return;
    celebratedForLevel.current = levelIndex;

    markLevelComplete(levelIndex);
    setCelebrate(true);
  }, [win, level, levelIndex, markLevelComplete]);

  function handleCelebrationDone() {
    setRevealWin(true);
    setShowConfetti(true);
    clearConfettiTimer();
    confettiTimerRef.current = setTimeout(() => setShowConfetti(false), 1300);
  }

  function onCommitRect(candidate: RectBounds) {
    commitRectAt(levelIndex, candidate);
  }

  function onTapCell(r: number, c: number) {
    tapCellAt(levelIndex, r, c);
  }

  function onResetPress() {
    resetCelebration();
    resetLevel(levelIndex);
  }

  function onHintPress() {
    const gaveHint = giveHint(levelIndex);
    if (!gaveHint) showToast('Every clue is already correctly filled in.');
  }

  function replayTutorial() {
    navigation.navigate('ShikakuTutorial', { tutorialKey: 'all', pendingLevelIndex: levelIndex });
  }

  function nextLevel() {
    navigation.replace('ShikakuGame', { levelIndex: levelIndex + 1 });
  }

  function onSkipPress() {
    if (win) return;
    markLevelSkipped(levelIndex);
    ensureLevel(levelIndex + 1);
    nextLevel();
  }

  if (!level) {
    return <SafeAreaView style={styles.screen} />;
  }

  return (
    <SafeAreaView style={styles.screen}>
      <TopBar
        onBack={() => navigation.navigate('ShikakuHub')}
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
        <Text style={[styles.statusPill, { color: cluesSolved === level.clues.length ? colors.success : colors.textDim }]}>
          Solved {cluesSolved}/{level.clues.length}
        </Text>
        {conflicts.size > 0 && <Text style={[styles.statusPill, { color: colors.signalRed }]}>Conflicts {conflicts.size}</Text>}
      </View>

      <View style={styles.boardArea}>
        <ShikakuGrid
          level={level}
          placed={placed}
          conflicts={conflicts}
          hintedClueIndices={hintedClueIndices}
          celebrate={celebrate}
          onCelebrationDone={handleCelebrationDone}
          onCommitRect={onCommitRect}
          onTapCell={onTapCell}
        />
      </View>

      <Text style={styles.legend}>drag to draw a rectangle over a clue · tap a rectangle to remove it</Text>

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
        subtitle="Every clue's rectangle fits — next board unlocked."
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
  // at the very bottom of the screen -- regardless of board size (5x6 to 10x10).
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
