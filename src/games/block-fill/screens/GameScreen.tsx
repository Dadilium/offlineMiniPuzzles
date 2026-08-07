import React, { useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { useHintGate } from '../../../ads/useHintGate';
import { useInterstitialOnComplete } from '../../../ads/useInterstitialOnComplete';
import { useRewardedSkip } from '../../../ads/useRewardedSkip';
import BlockFillGrid from '../components/BlockFillGrid';
import { computeWin, isStuck } from '../engine';
import { countFillable } from '../generation';
import type { BlockFillStackParamList } from '../navigation';
import { paletteForLevel } from '../palette';
import { useBlockFillProgress } from '../state/useBlockFillProgress';
import type { Cell } from '../types';

type Props = NativeStackScreenProps<BlockFillStackParamList, 'BlockFillGame'>;

const CONFETTI_PALETTE = [colors.purple, colors.gold, colors.cyan, colors.pink, colors.success, colors.signalBlue];

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

  const { notifyLevelCompleted } = useInterstitialOnComplete('block-fill');

  const [showConfetti, setShowConfetti] = useState(false);
  useEffect(() => {
    if (!path) return;
    if (win && !levelsCompleted.has(levelIndex)) {
      markLevelComplete(levelIndex);
      posthog?.capture('puzzle_level_completed', { game_id: 'block_fill', level_index: levelIndex + 1 });
      setShowConfetti(true);
      notifyLevelCompleted();
      const t = setTimeout(() => setShowConfetti(false), 1300);
      return () => clearTimeout(t);
    }
  }, [win, path, levelIndex, levelsCompleted, markLevelComplete, notifyLevelCompleted]);

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

  function attemptHint(): boolean {
    const cell = giveHint(levelIndex);
    if (!cell) {
      showToast(t('game.hintFailToast'));
      return false;
    }
    posthog?.capture('puzzle_hint_requested', { game_id: 'block_fill', level_index: levelIndex + 1 });
    if (hintTimer.current) clearTimeout(hintTimer.current);
    setHintCell(cell);
    hintTimer.current = setTimeout(() => setHintCell(null), 1500);
    return true;
  }

  const { hintCount, onHintPress } = useHintGate(attemptHint, () => showToast(tc('actions.hintAdNotReady')));

  function replayTutorial() {
    navigation.navigate('BlockFillTutorial', { tutorialKey: 'all', pendingLevelIndex: levelIndex });
  }

  function nextLevel() {
    navigation.replace('BlockFillGame', { levelIndex: levelIndex + 1 });
  }

  const { requestSkip, isAdReady: isSkipAdReady } = useRewardedSkip(() => {
    markLevelSkipped(levelIndex);
    posthog?.capture('puzzle_level_skipped', { game_id: 'block_fill', level_index: levelIndex + 1 });
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
    setHintCell(null);
    resetLevel(levelIndex);
  }

  if (!level || !path) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgDeep }} />;
  }

  const filledCount = path.length;

  return (
    <GameScreenLayout
      onBack={() => navigation.navigate('BlockFillHub')}
      backAccessibilityLabel={tc('actions.backToHub')}
      title={level.title ?? t('game.levelTitle', { number: levelIndex + 1 })}
      headerRight={
        <>
          <IconButton name="help" onPress={replayTutorial} accessibilityLabel={tc('actions.replayTutorial')} />
          <IconButton name="refresh-outline" onPress={onRetryPress} accessibilityLabel={tc('actions.resetLevel')} />
        </>
      }
      statusRow={
        <>
          <StatusPill color={palette.stroke}>{t('game.statusFilled', { count: filledCount, total: totalFillable })}</StatusPill>
          {stuck && <StatusPill color={colors.signalRed}>{t('game.stuckMessage')}</StatusPill>}
        </>
      }
      boardScrollable
      legend={t('game.legend')}
      controls={
        <>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <GameActionButton label={tc('actions.hintWithCount', { count: hintCount })} onPress={onHintPress} style={{ flex: 1 }} />
          </View>
          {!win && <GameActionButton label={tc('actions.skipLevelAd')} onPress={onSkipPress} variant="ghost" />}
        </>
      }
      winOverlay={
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
      }
    >
      <BlockFillGrid level={level} path={path} palette={palette} onDragToCell={onDragToCell} hintCell={hintCell} />
    </GameScreenLayout>
  );
}
