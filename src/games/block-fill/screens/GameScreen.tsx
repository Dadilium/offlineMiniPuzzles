import React, { useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import IconButton from '../../../components/IconButton';
import TopBar from '../../../components/TopBar';
import { useToast } from '../../../components/Toast';
import { colors, fonts, radii } from '../../../theme/colors';
import BlockFillGrid from '../components/BlockFillGrid';
import WinOverlay from '../components/WinOverlay';
import { computeWin, isStuck } from '../engine';
import { countFillable } from '../generation';
import type { BlockFillStackParamList } from '../navigation';
import { paletteForLevel } from '../palette';
import { useBlockFillProgress } from '../state/useBlockFillProgress';
import type { Cell } from '../types';

type Props = NativeStackScreenProps<BlockFillStackParamList, 'BlockFillGame'>;

export default function GameScreen({ route, navigation }: Props) {
  const { levelIndex } = route.params;
  const { levelFor, ensureLevel, pathsByLevel, extend, rewind, giveHint, resetLevel, markLevelComplete, markLevelSkipped, levelsCompleted } =
    useBlockFillProgress();
  const { showToast } = useToast();
  const { t } = useTranslation('block-fill');
  const { t: tc } = useTranslation('common');

  // Levels are generated on demand, not bundled -- ensureLevel triggers that
  // generation (and persists the result) as a side effect. Prefetch the next
  // one the moment this level opens, same rationale as Kings/Matching Numbers.
  useEffect(() => {
    ensureLevel(levelIndex);
    InteractionManager.runAfterInteractions(() => ensureLevel(levelIndex + 1));
  }, [levelIndex, ensureLevel]);

  const level = levelFor(levelIndex);
  const path = pathsByLevel[levelIndex];

  const [hintCell, setHintCell] = useState<Cell | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Paths persist forever, so reopening an already-completed level would
  // otherwise land straight on the filled board with the win popup showing.
  // Auto-restart it once per mount so there's always a fresh board to play.
  const restartedForLevel = useRef<number | null>(null);
  useEffect(() => {
    if (!level) return;
    if (restartedForLevel.current === levelIndex) return;
    restartedForLevel.current = levelIndex;
    if (levelsCompleted.has(levelIndex)) resetLevel(levelIndex);
  }, [levelIndex, level, levelsCompleted, resetLevel]);

  const win = useMemo(() => (level && path ? computeWin(level, path) : false), [level, path]);
  const stuck = useMemo(() => (level && path && !win ? isStuck(level, path) : false), [level, path, win]);
  const totalFillable = level ? countFillable(level.fillable) : 0;
  const palette = useMemo(() => paletteForLevel(levelIndex), [levelIndex]);

  const [showConfetti, setShowConfetti] = useState(false);
  useEffect(() => {
    if (!path) return;
    if (win && !levelsCompleted.has(levelIndex)) {
      markLevelComplete(levelIndex);
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 1300);
      return () => clearTimeout(t);
    }
  }, [win, path, levelIndex, levelsCompleted, markLevelComplete]);

  useEffect(() => {
    return () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
    };
  }, []);

  function onDragToCell(cell: Cell) {
    if (!path || win) return;
    const tip = path[path.length - 1];
    if (tip.r === cell.r && tip.c === cell.c) return;

    if (hintCell) {
      if (hintTimer.current) clearTimeout(hintTimer.current);
      setHintCell(null);
    }

    const onPath = path.some((p) => p.r === cell.r && p.c === cell.c);
    if (onPath) rewind(levelIndex, cell);
    else extend(levelIndex, cell);
  }

  function onHintPress() {
    const cell = giveHint(levelIndex);
    if (!cell) {
      showToast(t('game.hintFailToast'));
      return;
    }
    if (hintTimer.current) clearTimeout(hintTimer.current);
    setHintCell(cell);
    hintTimer.current = setTimeout(() => setHintCell(null), 1500);
  }

  function replayTutorial() {
    navigation.navigate('BlockFillTutorial', { tutorialKey: 'all', pendingLevelIndex: levelIndex });
  }

  function nextLevel() {
    navigation.replace('BlockFillGame', { levelIndex: levelIndex + 1 });
  }

  function onSkipPress() {
    if (win) return;
    markLevelSkipped(levelIndex);
    ensureLevel(levelIndex + 1);
    nextLevel();
  }

  function onRetryPress() {
    setHintCell(null);
    resetLevel(levelIndex);
  }

  if (!level || !path) {
    return <SafeAreaView style={styles.screen} />;
  }

  const filledCount = path.length;

  return (
    <SafeAreaView style={styles.screen}>
      <TopBar
        onBack={() => navigation.navigate('BlockFillHub')}
        backAccessibilityLabel={tc('actions.backToHub')}
        eyebrow={t('game.levelEyebrow', { number: levelIndex + 1 })}
        title={level.title ?? t('game.levelTitle', { number: levelIndex + 1 })}
        right={
          <>
            <IconButton glyph="?" onPress={replayTutorial} accessibilityLabel={tc('actions.replayTutorial')} />
            <IconButton glyph="⟲" onPress={onRetryPress} accessibilityLabel={tc('actions.resetLevel')} size={40} glyphSize={19} />
          </>
        }
      />

      <View style={styles.statusRow}>
        <Text style={[styles.statusPill, { color: palette.stroke }]}>
          {t('game.statusFilled', { count: filledCount, total: totalFillable })}
        </Text>
        {stuck && <Text style={[styles.statusPill, { color: colors.signalRed }]}>{t('game.stuckMessage')}</Text>}
      </View>

      <ScrollView style={styles.boardArea} contentContainerStyle={styles.boardAreaContent}>
        <BlockFillGrid level={level} path={path} palette={palette} onDragToCell={onDragToCell} hintCell={hintCell} />
      </ScrollView>

      <Text style={styles.legend}>{t('game.legend')}</Text>

      <View style={styles.controls}>
        <View style={styles.controlsRow}>
          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.75} onPress={onHintPress}>
            <Text style={styles.actionBtnText}>{tc('actions.hint')}</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDeep },
  statusRow: { flexDirection: 'row', gap: 14, flexWrap: 'wrap', paddingHorizontal: 18, paddingTop: 8, justifyContent: 'center' },
  statusPill: { fontSize: 11.5, fontWeight: '600', fontFamily: fonts.mono },
  boardArea: { flex: 1 },
  boardAreaContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 12 },
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
