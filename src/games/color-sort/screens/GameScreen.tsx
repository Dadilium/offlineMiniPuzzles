import React, { useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import IconButton from '../../../components/IconButton';
import GameActionButton from '../../../components/GameActionButton';
import GameScreenLayout from '../../../components/GameScreenLayout';
import StatusPill from '../../../components/StatusPill';
import { useToast } from '../../../components/Toast';
import WinOverlay from '../../../components/WinOverlay';
import { colors } from '../../../theme/colors';
import { posthog } from '../../../config/posthog';
import { useHintGate } from '../../../ads/useHintGate';
import { useInterstitialOnComplete } from '../../../ads/useInterstitialOnComplete';
import { useRewardedSkip } from '../../../ads/useRewardedSkip';
import ColorSortBoard from '../components/ColorSortBoard';
import { ACCENT_PALETTE } from '../components/TutorialDiagram';
import { computeWin, isStuck } from '../engine';
import type { Move } from '../generation';
import type { ColorSortStackParamList } from '../navigation';
import { useColorSortProgress } from '../state/useColorSortProgress';
import type { Tube } from '../types';

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
    undoMove,
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
  // Snapshots of `tubes` taken right before each valid pour -- backs the undo
  // button. Lives here (not in the persisted provider) since it's only ever
  // needed for the current play session and shouldn't grow storage forever.
  const [history, setHistory] = useState<Tube[][]>([]);
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

  const { notifyLevelCompleted } = useInterstitialOnComplete('color-sort');

  useEffect(() => {
    if (!level) return;
    if (restartedForLevel.current === levelIndex) return;
    restartedForLevel.current = levelIndex;
    if (levelsCompleted.has(levelIndex)) {
      resetCelebration();
      resetLevel(levelIndex);
      setHistory([]);
    }
  }, [levelIndex, level, levelsCompleted, resetLevel]);

  useEffect(() => {
    if (!level || !tubes) return;
    if (!win) return;
    if (celebratedForLevel.current === levelIndex) return;
    celebratedForLevel.current = levelIndex;

    markLevelComplete(levelIndex);
    posthog?.capture('puzzle_level_completed', { game_id: 'color_sort', level_index: levelIndex + 1, move_count: moveCount });
    setCelebrate(true);
    setShowConfetti(true);
    notifyLevelCompleted();
    const confettiTimer = setTimeout(() => setShowConfetti(false), 1300);
    return () => clearTimeout(confettiTimer);
  }, [win, level, tubes, levelIndex, markLevelComplete, notifyLevelCompleted]);

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

    const snapshot = tubes.map((t) => t.slice());
    const applied = pourAt(levelIndex, selected, index);
    if (applied) {
      setHistory((h) => [...h, snapshot]);
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
    setHistory([]);
  }

  function onUndoPress() {
    if (history.length === 0 || win) return;
    const previous = history[history.length - 1];
    setSelected(null);
    clearHint();
    if (pourTimer.current) clearTimeout(pourTimer.current);
    setPouring(null);
    undoMove(levelIndex, previous);
    setHistory((h) => h.slice(0, -1));
  }

  function attemptHint(): boolean {
    const move = giveHint(levelIndex);
    if (!move) {
      showToast(t('game.hintFailToast'));
      return false;
    }
    setSelected(null);
    posthog?.capture('puzzle_hint_requested', { game_id: 'color_sort', level_index: levelIndex + 1 });
    if (hintTimer.current) clearTimeout(hintTimer.current);
    setHint(move);
    hintTimer.current = setTimeout(() => setHint(null), HINT_DURATION_MS);
    return true;
  }

  const { hintCount, onHintPress } = useHintGate(attemptHint, () => showToast(tc('actions.hintAdNotReady')));

  function replayTutorial() {
    navigation.navigate('ColorSortTutorial', { tutorialKey: 'all', pendingLevelIndex: levelIndex });
  }

  function nextLevel() {
    navigation.replace('ColorSortGame', { levelIndex: levelIndex + 1 });
  }

  const { requestSkip, isAdReady: isSkipAdReady } = useRewardedSkip(() => {
    markLevelSkipped(levelIndex);
    posthog?.capture('puzzle_level_skipped', { game_id: 'color_sort', level_index: levelIndex + 1 });
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

  if (!level || !tubes) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgDeep }} />;
  }

  return (
    <GameScreenLayout
      onBack={() => navigation.navigate('ColorSortHub')}
      backAccessibilityLabel={tc('actions.backToHub')}
      title={level.title ?? t('game.levelTitle', { number: levelIndex + 1 })}
      headerRight={
        <>
          <IconButton name="help" onPress={replayTutorial} accessibilityLabel={tc('actions.replayTutorial')} />
          <IconButton name="refresh-outline" onPress={onResetPress} accessibilityLabel={tc('actions.resetLevel')} />
        </>
      }
      statusRow={
        <>
          <StatusPill color={colors.text} dim={t('game.statusPar', { count: level.parMoves })}>
            {t('game.statusMoves', { count: moveCount })}
          </StatusPill>
          {stuck && <StatusPill color={colors.signalRed}>{t('game.stuckMessage')}</StatusPill>}
        </>
      }
      legend={t('game.legend')}
      controls={
        <>
          <GameActionButton label={tc('actions.hintWithCount', { count: hintCount })} onPress={onHintPress} />
          {!celebrate && <GameActionButton label={tc('actions.undoMove')} onPress={onUndoPress} disabled={history.length === 0} />}
          {!celebrate && <GameActionButton label={tc('actions.skipLevelAd')} onPress={onSkipPress} variant="ghost" />}
        </>
      }
      winOverlay={
        <WinOverlay
          visible={celebrate}
          badge="👑"
          showConfetti={showConfetti}
          confettiPalette={ACCENT_PALETTE}
          title={t('game.winTitle')}
          subtitle={t('game.winSubtitle', { count: moveCount, par: level.parMoves })}
          nextLabel={tc('actions.nextLevel')}
          onNext={nextLevel}
        />
      }
    >
      <ColorSortBoard
        tubes={tubes}
        capacity={level.capacity}
        selected={selected}
        hint={hint}
        shakeTube={shakeTube}
        pouring={pouring}
        onTubePress={onTubePress}
      />
    </GameScreenLayout>
  );
}
