import React, { useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager } from 'react-native';
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
import ShikakuGrid from '../components/ShikakuGrid';
import { computeConflicts, computeWin } from '../engine';
import type { ShikakuStackParamList } from '../navigation';
import { useShikakuProgress } from '../state/useShikakuProgress';
import type { RectBounds, ShikakuPlayerState } from '../types';

type Props = NativeStackScreenProps<ShikakuStackParamList, 'ShikakuGame'>;

const EMPTY_PLACED: ShikakuPlayerState = [];
const EMPTY_HINTED = new Set<number>();
const EMPTY_CONFLICTS = new Set<number>();

const CONFETTI_PALETTE = [colors.success, colors.signalBlue, colors.warn, colors.purple, colors.cyan, colors.gold];

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
  const { t } = useTranslation('shikaku');
  const { t: tc } = useTranslation('common');

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

  const { notifyLevelCompleted } = useInterstitialOnComplete('shikaku');

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
    posthog?.capture('puzzle_level_completed', { game_id: 'shikaku', level_index: levelIndex + 1 });
    setCelebrate(true);
  }, [win, level, levelIndex, markLevelComplete]);

  function handleCelebrationDone() {
    setRevealWin(true);
    setShowConfetti(true);
    notifyLevelCompleted();
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

  function attemptHint(): boolean {
    const gaveHint = giveHint(levelIndex);
    if (gaveHint) posthog?.capture('puzzle_hint_requested', { game_id: 'shikaku', level_index: levelIndex + 1 });
    else showToast(t('game.hintFailToast'));
    return gaveHint;
  }

  const { hintCount, onHintPress } = useHintGate(attemptHint, () => showToast(tc('actions.hintAdNotReady')));

  function replayTutorial() {
    navigation.navigate('ShikakuTutorial', { tutorialKey: 'all', pendingLevelIndex: levelIndex });
  }

  function nextLevel() {
    navigation.replace('ShikakuGame', { levelIndex: levelIndex + 1 });
  }

  const { requestSkip, isAdReady: isSkipAdReady } = useRewardedSkip(() => {
    markLevelSkipped(levelIndex);
    posthog?.capture('puzzle_level_skipped', { game_id: 'shikaku', level_index: levelIndex + 1 });
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

  if (!level) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgDeep }} />;
  }

  return (
    <GameScreenLayout
      onBack={() => navigation.navigate('ShikakuHub')}
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
          <StatusPill color={cluesSolved === level.clues.length ? colors.success : colors.textDim}>
            {t('game.statusSolved', { count: cluesSolved, total: level.clues.length })}
          </StatusPill>
          {conflicts.size > 0 && <StatusPill color={colors.signalRed}>{t('game.statusConflicts', { count: conflicts.size })}</StatusPill>}
        </>
      }
      legend={t('game.legend')}
      controls={
        <>
          <GameActionButton label={tc('actions.hintWithCount', { count: hintCount })} onPress={onHintPress} />
          {!revealWin && <GameActionButton label={tc('actions.skipLevelAd')} onPress={onSkipPress} variant="ghost" />}
        </>
      }
      winOverlay={
        <WinOverlay
          visible={revealWin}
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
    </GameScreenLayout>
  );
}
