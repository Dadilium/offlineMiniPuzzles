import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
import BudgetChip from '../components/BudgetChip';
import KindChip from '../components/KindChip';
import RelayGrid, { RECEIVER_SETTLE_MS } from '../components/RelayGrid';
import { computeColorConnectivity, computeJammed, isFixed, isTerrain } from '../engine';
import { levels } from '../levels';
import { enterLevel, type RelayStackParamList } from '../navigation';
import { useRelayProgress } from '../state/useRelayProgress';
import type { ConnectivityResult, RelayKind, SignalColor } from '../types';

const RELAY_KINDS: RelayKind[] = ['circle', 'beam'];

type Props = NativeStackScreenProps<RelayStackParamList, 'RelayGame'>;

const SIGNAL_COLORS: Record<SignalColor, string> = { blue: colors.signalBlue, red: colors.signalRed };

export default function GameScreen({ route, navigation }: Props) {
  const { levelIndex } = route.params;
  const level = levels[levelIndex];
  const { relaysByLevel, toggleRelay, giveHint, resetLevel, markLevelComplete, markLevelSkipped, levelsCompleted, tutorialsSeen } =
    useRelayProgress();
  const { showToast } = useToast();
  const { t } = useTranslation('relay');
  const { t: tc } = useTranslation('common');
  const relays = relaysByLevel[levelIndex] ?? [];

  const colorList = Object.keys(level.budgets) as SignalColor[];
  const isMulti = level.sources.length > 1;
  const [selectedColor, setSelectedColor] = useState<SignalColor>(colorList[0]);
  const activeColor = colorList.includes(selectedColor) ? selectedColor : colorList[0];

  // Beam is strictly weaker than circle with no mirrors to bend off, so the
  // kind choice is only ever meaningful -- and only ever shown -- on levels
  // that have some.
  const hasMirrors = (level.mirrors ?? []).length > 0;
  const [selectedKind, setSelectedKind] = useState<RelayKind>('circle');

  const jammed = useMemo(() => computeJammed(level, relays), [level, relays]);
  const results = useMemo(() => {
    const out: Partial<Record<SignalColor, ConnectivityResult>> = {};
    level.sources.forEach((s) => {
      out[s.color] = computeColorConnectivity(s.color, level, relays, jammed);
    });
    return out;
  }, [level, relays, jammed]);

  const allReached = level.sources.every((s) => results[s.color]?.receiverReached);

  useEffect(() => {
    if (allReached && !levelsCompleted.has(levelIndex)) {
      markLevelComplete(levelIndex);
      posthog?.capture('puzzle_level_completed', { game_id: 'relay', level_index: levelIndex + 1 });
    }
  }, [allReached, levelIndex, levelsCompleted, markLevelComplete]);

  // Delay the win overlay until every receiver's grow-in + bounce animation
  // (RelayGrid's RECEIVER_SETTLE_MS) has fully settled, plus a bit of extra
  // breathing room, before it pops up.
  const WIN_OVERLAY_EXTRA_DELAY_MS = 300;
  const [showWinOverlay, setShowWinOverlay] = useState(false);
  useEffect(() => {
    if (!allReached) {
      setShowWinOverlay(false);
      return;
    }
    const timer = setTimeout(() => setShowWinOverlay(true), RECEIVER_SETTLE_MS + WIN_OVERLAY_EXTRA_DELAY_MS);
    return () => clearTimeout(timer);
  }, [allReached]);

  // Relay placements persist forever, so reopening an already-completed level
  // would otherwise land straight on the solved board with the win popup
  // showing. Auto-restart it once per mount so there's always a fresh board.
  const restartedForLevel = useRef<number | null>(null);
  useEffect(() => {
    if (restartedForLevel.current === levelIndex) return;
    restartedForLevel.current = levelIndex;
    if (levelsCompleted.has(levelIndex)) resetLevel(levelIndex);
  }, [levelIndex, levelsCompleted, resetLevel]);

  function onCellPress(x: number, y: number) {
    if (isTerrain(x, y, level) || isFixed(x, y, level)) return;
    const color = isMulti ? activeColor : level.sources[0].color;
    const kind = hasMirrors ? selectedKind : 'circle';
    const budget = level.budgets[color] ?? 0;
    const outcome = toggleRelay(levelIndex, x, y, color, budget, kind);
    if (outcome === 'budget-full') showToast(t('game.budgetFullToast', { color: t(`game.colorNamesLower.${color}`) }));
    if (outcome === 'locked') showToast(t('game.hintLockedToast'));
  }

  function attemptHint(): boolean {
    const result = giveHint(levelIndex);
    if (result.outcome === 'placed') {
      posthog?.capture('puzzle_hint_requested', { game_id: 'relay', level_index: levelIndex + 1 });
      return true;
    }
    if (result.outcome === 'solved') showToast(t('game.hintSolvedToast'));
    if (result.outcome === 'budget-full' && result.color) {
      showToast(t('game.hintBudgetFullToast', { color: t(`game.colorNamesLower.${result.color}`) }));
    }
    return false;
  }

  const { hintCount, onHintPress } = useHintGate(attemptHint, () => showToast(tc('actions.hintAdNotReady')));

  function nextLevel() {
    if (levelIndex < levels.length - 1) {
      enterLevel(navigation, levelIndex + 1, tutorialsSeen, 'replace');
    } else {
      navigation.navigate('RelayHub');
    }
  }

  function onSkipPress() {
    if (allReached) return;
    markLevelSkipped(levelIndex);
    posthog?.capture('puzzle_level_skipped', { game_id: 'relay', level_index: levelIndex + 1 });
    nextLevel();
  }

  function replayTutorial() {
    navigation.navigate('RelayTutorial', { tutorialKey: 'all', pendingLevelIndex: levelIndex });
  }

  return (
    <GameScreenLayout
      onBack={() => navigation.navigate('RelayHub')}
      backAccessibilityLabel={tc('actions.backToHub')}
      eyebrow={t('game.levelEyebrow', { current: levelIndex + 1, total: levels.length })}
      title={level.title}
      headerRight={
        <>
          <IconButton name="help" onPress={replayTutorial} accessibilityLabel={tc('actions.replayTutorial')} />
          <IconButton name="refresh-outline" onPress={() => resetLevel(levelIndex)} accessibilityLabel={tc('actions.resetLevel')} />
        </>
      }
      statusRow={
        <View style={styles.statusRowInner}>
          {level.instructions ? <Text style={styles.instructions}>{level.instructions}</Text> : null}

          <View style={styles.chipsRow}>
            {colorList.map((color) => (
              <BudgetChip
                key={color}
                color={color}
                used={relays.filter((r) => r.color === color).length}
                budget={level.budgets[color] ?? 0}
                active={isMulti && activeColor === color}
                selectable={isMulti}
                onPress={() => setSelectedColor(color)}
              />
            ))}
          </View>

          {hasMirrors ? (
            <View style={styles.chipsRow}>
              {RELAY_KINDS.map((kind) => (
                <KindChip key={kind} kind={kind} active={selectedKind === kind} onPress={() => setSelectedKind(kind)} />
              ))}
            </View>
          ) : null}

          <View style={styles.pillsRow}>
            {level.sources.map((s) => (
              <StatusPill key={s.color} color={SIGNAL_COLORS[s.color]}>
                {t(`game.colorNames.${s.color}`)}: {results[s.color]?.receiverReached ? '✅' : '❌'}
              </StatusPill>
            ))}
          </View>
        </View>
      }
      legend={t('game.legend')}
      controls={
        <>
          <GameActionButton label={tc('actions.hintWithCount', { count: hintCount })} onPress={onHintPress} />
          <GameActionButton label={tc('actions.skipLevelAd')} onPress={onSkipPress} variant="ghost" hidden={allReached} />
        </>
      }
      winOverlay={
        <WinOverlay
          visible={showWinOverlay}
          badge="👑"
          title={t('game.winTitle')}
          subtitle={levelIndex < levels.length - 1 ? t('game.winSubtitleNext') : t('game.winSubtitleLast')}
          nextLabel={levelIndex < levels.length - 1 ? tc('actions.nextLevel') : tc('actions.backToHub')}
          onNext={nextLevel}
        />
      }
    >
      <RelayGrid level={level} relays={relays} jammed={jammed} results={results} onCellPress={onCellPress} />
    </GameScreenLayout>
  );
}

const styles = StyleSheet.create({
  statusRowInner: { width: '100%' },
  instructions: { fontSize: 12, color: colors.textDim, textAlign: 'center', marginBottom: 8 },
  chipsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 8 },
  pillsRow: { flexDirection: 'row', gap: 14, flexWrap: 'wrap', justifyContent: 'center', minHeight: 34 },
});
