import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import IconButton from '../../../components/IconButton';
import TopBar from '../../../components/TopBar';
import { useToast } from '../../../components/Toast';
import { colors, fonts, radii } from '../../../theme/colors';
import BudgetChip from '../components/BudgetChip';
import KindChip from '../components/KindChip';
import RelayGrid, { RECEIVER_SETTLE_MS } from '../components/RelayGrid';
import WinOverlay from '../components/WinOverlay';
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

  function onHintPress() {
    const result = giveHint(levelIndex);
    if (result.outcome === 'solved') showToast(t('game.hintSolvedToast'));
    if (result.outcome === 'budget-full' && result.color) {
      showToast(t('game.hintBudgetFullToast', { color: t(`game.colorNamesLower.${result.color}`) }));
    }
  }

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
    nextLevel();
  }

  function replayTutorial() {
    navigation.navigate('RelayTutorial', { tutorialKey: 'all', pendingLevelIndex: levelIndex });
  }

  return (
    <SafeAreaView style={styles.screen}>
      <TopBar
        onBack={() => navigation.navigate('RelayHub')}
        backAccessibilityLabel={tc('actions.backToHub')}
        eyebrow={t('game.levelEyebrow', { current: levelIndex + 1, total: levels.length })}
        title={level.title}
        right={
          <>
            <IconButton glyph="↺" onPress={replayTutorial} accessibilityLabel={tc('actions.replayTutorial')} />
            <IconButton glyph="⟲" onPress={() => resetLevel(levelIndex)} accessibilityLabel={tc('actions.resetLevel')} />
          </>
        }
      />

      {level.instructions ? <Text style={styles.instructions}>{level.instructions}</Text> : null}

      <View style={styles.budgetsRow}>
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
        <View style={styles.budgetsRow}>
          {RELAY_KINDS.map((kind) => (
            <KindChip key={kind} kind={kind} active={selectedKind === kind} onPress={() => setSelectedKind(kind)} />
          ))}
        </View>
      ) : null}

      <View style={styles.statusRow}>
        {level.sources.map((s) => (
          <Text key={s.color} style={[styles.statusPill, { color: SIGNAL_COLORS[s.color] }]}>
            {t(`game.colorNames.${s.color}`)}: {results[s.color]?.receiverReached ? '✅' : '❌'}
          </Text>
        ))}
      </View>

      <View style={styles.boardArea}>
        <RelayGrid level={level} relays={relays} jammed={jammed} results={results} onCellPress={onCellPress} />
      </View>

      <Text style={styles.legend}>{t('game.legend')}</Text>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.hintBtn} activeOpacity={0.75} onPress={onHintPress}>
          <Text style={styles.hintBtnText}>{tc('actions.hint')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.skipBtn, allReached && styles.skipBtnHidden]}
          activeOpacity={0.75}
          onPress={onSkipPress}
          disabled={allReached}
        >
          <Text style={styles.skipBtnText}>{tc('actions.skipLevelAd')}</Text>
        </TouchableOpacity>
      </View>

      <WinOverlay
        visible={showWinOverlay}
        title={t('game.winTitle')}
        subtitle={levelIndex < levels.length - 1 ? t('game.winSubtitleNext') : t('game.winSubtitleLast')}
        nextLabel={levelIndex < levels.length - 1 ? tc('actions.nextLevel') : tc('actions.backToHub')}
        onNext={nextLevel}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDeep },
  instructions: { fontSize: 12, color: colors.textDim, paddingHorizontal: 20, paddingTop: 8, textAlign: 'center' },
  budgetsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', paddingHorizontal: 18, paddingTop: 10, justifyContent: 'center' },
  statusRow: { flexDirection: 'row', gap: 14, flexWrap: 'wrap', paddingHorizontal: 18, paddingTop: 8, justifyContent: 'center', minHeight: 34 },
  statusPill: { fontSize: 11.5, lineHeight: 18, fontWeight: '600', fontFamily: fonts.mono },
  // Takes up all remaining vertical space between the status row and the
  // bottom controls, so the board is always centered and Hint always sits
  // at the very bottom of the screen.
  boardArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  legend: { fontSize: 10.5, color: colors.textFaint, paddingHorizontal: 18, textAlign: 'center', fontFamily: fonts.mono, lineHeight: 16 },
  controls: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 6, gap: 8 },
  hintBtn: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingVertical: 13, alignItems: 'center' },
  hintBtnText: { color: colors.text, fontWeight: '600', fontSize: 14 },
  // Stays mounted (taking up its usual space) even once the level is
  // solved -- only its visibility toggles -- so `controls`, and therefore
  // `boardArea` above it (flex: 1), never resizes on completion.
  skipBtn: { paddingVertical: 8, alignItems: 'center' },
  skipBtnHidden: { opacity: 0 },
  skipBtnText: { color: colors.textFaint, fontWeight: '600', fontSize: 12 },
});
