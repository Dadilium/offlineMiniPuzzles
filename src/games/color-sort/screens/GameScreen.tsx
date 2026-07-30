import React, { useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import IconButton from '../../../components/IconButton';
import TopBar from '../../../components/TopBar';
import { useToast } from '../../../components/Toast';
import { colors, fonts, radii } from '../../../theme/colors';
import ColorSortBoard from '../components/ColorSortBoard';
import WinOverlay from '../components/WinOverlay';
import { computeWin, isStuck } from '../engine';
import type { Move } from '../generation';
import type { ColorSortStackParamList } from '../navigation';
import { useColorSortProgress } from '../state/useColorSortProgress';

type Props = NativeStackScreenProps<ColorSortStackParamList, 'ColorSortGame'>;

const HINT_DURATION_MS = 1600;
const SHAKE_DURATION_MS = 260;
const POUR_DURATION_MS = 380;

export default function GameScreen({ route, navigation }: Props) {
  const { levelIndex } = route.params;
  const {
    levelFor,
    ensureLevel,
    tubesByLevel,
    moveCountByLevel,
    pourAt,
    giveHint,
    resetLevel,
    markLevelComplete,
    markLevelSkipped,
    levelsCompleted,
  } = useColorSortProgress();
  const { showToast } = useToast();
  const { t } = useTranslation('color-sort');
  const { t: tc } = useTranslation('common');

  // Levels are generated on demand, not bundled -- ensureLevel triggers that
  // generation (and persists the result) as a side effect. Prefetch the
  // next one the moment this level opens, same rationale as every other game.
  useEffect(() => {
    ensureLevel(levelIndex);
    InteractionManager.runAfterInteractions(() => ensureLevel(levelIndex + 1));
  }, [levelIndex, ensureLevel]);

  const level = levelFor(levelIndex);
  const tubes = level ? tubesByLevel[levelIndex] : undefined;
  const moveCount = moveCountByLevel[levelIndex] ?? 0;

  const [selected, setSelected] = useState<number | null>(null);
  const [hint, setHint] = useState<Move | null>(null);
  const [shakeTube, setShakeTube] = useState<number | null>(null);
  const [pouring, setPouring] = useState<Move | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pourTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
      if (pourTimer.current) clearTimeout(pourTimer.current);
    };
  }, []);

  const win = useMemo(() => (level && tubes ? computeWin(tubes, level.capacity) : false), [level, tubes]);
  const stuck = useMemo(() => (level && tubes && !win ? isStuck(tubes, level.capacity) : false), [level, tubes, win]);

  // Tubes persist forever, so reopening an already-completed level would
  // otherwise land straight on the solved board with the win popup showing.
  // Auto-restart it once per mount so there's always a fresh board to play.
  const restartedForLevel = useRef<number | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const celebratedForLevel = useRef<number | null>(null);

  function resetCelebration() {
    setCelebrate(false);
    setShowConfetti(false);
    celebratedForLevel.current = null;
  }

  useEffect(() => {
    if (!level) return;
    if (restartedForLevel.current === levelIndex) return;
    restartedForLevel.current = levelIndex;
    if (levelsCompleted.has(levelIndex)) {
      resetCelebration();
      resetLevel(levelIndex);
    }
  }, [levelIndex, level, levelsCompleted, resetLevel]);

  useEffect(() => {
    if (!level || !tubes) return;
    if (!win) return;
    if (celebratedForLevel.current === levelIndex) return;
    celebratedForLevel.current = levelIndex;

    markLevelComplete(levelIndex);
    setCelebrate(true);
    setShowConfetti(true);
    const confettiTimer = setTimeout(() => setShowConfetti(false), 1300);
    return () => clearTimeout(confettiTimer);
  }, [win, level, tubes, levelIndex, markLevelComplete]);

  function clearHint() {
    if (hintTimer.current) clearTimeout(hintTimer.current);
    setHint(null);
  }

  function onTubePress(index: number) {
    if (!tubes || win) return;
    if (hint) clearHint();

    if (selected === null) {
      if (tubes[index].length > 0) setSelected(index);
      return;
    }
    if (selected === index) {
      setSelected(null);
      return;
    }

    const applied = pourAt(levelIndex, selected, index);
    if (applied) {
      setPouring({ from: selected, to: index });
      if (pourTimer.current) clearTimeout(pourTimer.current);
      pourTimer.current = setTimeout(() => setPouring(null), POUR_DURATION_MS);
      setSelected(null);
    } else {
      setShakeTube(index);
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
      shakeTimer.current = setTimeout(() => setShakeTube(null), SHAKE_DURATION_MS);
      // Very likely the player meant to pick up THIS tube instead --
      // switching selection reads more natural than just erroring out.
      setSelected(tubes[index].length > 0 ? index : null);
    }
  }

  function onResetPress() {
    setSelected(null);
    clearHint();
    if (pourTimer.current) clearTimeout(pourTimer.current);
    setPouring(null);
    resetCelebration();
    resetLevel(levelIndex);
  }

  function onHintPress() {
    const move = giveHint(levelIndex);
    if (!move) {
      showToast(t('game.hintFailToast'));
      return;
    }
    setSelected(null);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    setHint(move);
    hintTimer.current = setTimeout(() => setHint(null), HINT_DURATION_MS);
  }

  function replayTutorial() {
    navigation.navigate('ColorSortTutorial', { tutorialKey: 'all', pendingLevelIndex: levelIndex });
  }

  function nextLevel() {
    navigation.replace('ColorSortGame', { levelIndex: levelIndex + 1 });
  }

  function onSkipPress() {
    if (win) return;
    markLevelSkipped(levelIndex);
    ensureLevel(levelIndex + 1);
    nextLevel();
  }

  if (!level || !tubes) {
    return <SafeAreaView style={styles.screen} />;
  }

  return (
    <SafeAreaView style={styles.screen}>
      <TopBar
        onBack={() => navigation.navigate('ColorSortHub')}
        backAccessibilityLabel={tc('actions.backToHub')}
        eyebrow={t('game.levelEyebrow', { number: levelIndex + 1 })}
        title={level.title ?? t('game.levelTitle', { number: levelIndex + 1 })}
        right={
          <>
            <IconButton glyph="?" onPress={replayTutorial} accessibilityLabel={tc('actions.replayTutorial')} />
            <IconButton glyph="⟲" onPress={onResetPress} accessibilityLabel={tc('actions.resetLevel')} size={40} glyphSize={19} />
          </>
        }
      />

      <View style={styles.statusRow}>
        <Text style={styles.statusPill}>
          {t('game.statusMoves', { count: moveCount })} <Text style={styles.statusPillDim}>{t('game.statusPar', { count: level.parMoves })}</Text>
        </Text>
        {stuck && <Text style={[styles.statusPill, { color: colors.signalRed }]}>{t('game.stuckMessage')}</Text>}
      </View>

      <View style={styles.boardArea}>
        <ColorSortBoard
          tubes={tubes}
          capacity={level.capacity}
          selected={selected}
          hint={hint}
          shakeTube={shakeTube}
          pouring={pouring}
          onTubePress={onTubePress}
        />
      </View>

      <Text style={styles.legend}>{t('game.legend')}</Text>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.hintBtn} activeOpacity={0.75} onPress={onHintPress}>
          <Text style={styles.hintBtnText}>{tc('actions.hint')}</Text>
        </TouchableOpacity>
        {!celebrate && (
          <TouchableOpacity style={styles.skipBtn} activeOpacity={0.75} onPress={onSkipPress}>
            <Text style={styles.skipBtnText}>{tc('actions.skipLevelAd')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <WinOverlay
        visible={celebrate}
        showConfetti={showConfetti}
        title={t('game.winTitle')}
        subtitle={t('game.winSubtitle', { count: moveCount, par: level.parMoves })}
        nextLabel={tc('actions.nextLevel')}
        onNext={nextLevel}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDeep },
  statusRow: { flexDirection: 'row', gap: 14, flexWrap: 'wrap', paddingHorizontal: 18, paddingTop: 8, justifyContent: 'center' },
  statusPill: { fontSize: 11.5, fontWeight: '600', fontFamily: fonts.mono, color: colors.text },
  statusPillDim: { color: colors.textDim, fontWeight: '600' },
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
