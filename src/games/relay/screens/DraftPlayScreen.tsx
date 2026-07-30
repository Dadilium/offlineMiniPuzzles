import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import IconButton from '../../../components/IconButton';
import TopBar from '../../../components/TopBar';
import { useToast } from '../../../components/Toast';
import { colors, fonts, radii } from '../../../theme/colors';
import BudgetChip from '../components/BudgetChip';
import KindChip from '../components/KindChip';
import RelayGrid, { RECEIVER_SETTLE_MS } from '../components/RelayGrid';
import WinOverlay from '../components/WinOverlay';
import { computeColorConnectivity, computeJammed, findHintCell, isFixed, isTerrain } from '../engine';
import type { RelayStackParamList } from '../navigation';
import type { ConnectivityResult, PlacedRelay, RelayKind, SignalColor } from '../types';

const RELAY_KINDS: RelayKind[] = ['circle', 'beam'];
const WIN_OVERLAY_EXTRA_DELAY_MS = 300;
const SIGNAL_COLORS: Record<SignalColor, string> = { blue: colors.signalBlue, red: colors.signalRed };

type Props = NativeStackScreenProps<RelayStackParamList, 'RelayDraftPlay'>;

// Dev-only play surface for a level that hasn't shipped yet -- deliberately
// doesn't touch useRelayProgress (which is keyed by index into the shipped
// `levels` array and has no meaningful slot for a draft), so relay
// placements here are just local component state, gone on back-out.
export default function DraftPlayScreen({ route, navigation }: Props) {
  const { level } = route.params;
  const { showToast } = useToast();
  const [relays, setRelays] = useState<PlacedRelay[]>([]);

  const colorList = Object.keys(level.budgets) as SignalColor[];
  const isMulti = level.sources.length > 1;
  const [selectedColor, setSelectedColor] = useState<SignalColor>(colorList[0]);
  const activeColor = colorList.includes(selectedColor) ? selectedColor : colorList[0];

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

  const [showWinOverlay, setShowWinOverlay] = useState(false);
  useEffect(() => {
    if (!allReached) {
      setShowWinOverlay(false);
      return;
    }
    const timer = setTimeout(() => setShowWinOverlay(true), RECEIVER_SETTLE_MS + WIN_OVERLAY_EXTRA_DELAY_MS);
    return () => clearTimeout(timer);
  }, [allReached]);

  function onCellPress(x: number, y: number) {
    if (isTerrain(x, y, level) || isFixed(x, y, level)) return;
    const color = isMulti ? activeColor : level.sources[0].color;
    const kind = hasMirrors ? selectedKind : 'circle';
    const budget = level.budgets[color] ?? 0;

    setRelays((prev) => {
      const existingIdx = prev.findIndex((r) => r.x === x && r.y === y);
      if (existingIdx >= 0) {
        if (prev[existingIdx].locked) {
          showToast('That relay was revealed by a hint — remove another one instead.');
          return prev;
        }
        return prev.slice(0, existingIdx).concat(prev.slice(existingIdx + 1));
      }
      const used = prev.filter((r) => r.color === color).length;
      if (used >= budget) {
        showToast(`No ${color} relays left`);
        return prev;
      }
      return prev.concat([{ x, y, color, kind }]);
    });
  }

  function onHintPress() {
    let budgetBlockedColor: SignalColor | undefined;
    for (const source of level.sources) {
      const color = source.color;
      const cell = findHintCell(level, relays, color);
      if (!cell) continue;
      const used = relays.filter((r) => r.color === color).length;
      const budget = level.budgets[color] ?? 0;
      if (used >= budget) {
        budgetBlockedColor = budgetBlockedColor ?? color;
        continue;
      }
      setRelays((prev) => prev.concat([{ x: cell.x, y: cell.y, color, locked: true, kind: cell.kind }]));
      return;
    }
    if (budgetBlockedColor) {
      showToast(`No ${budgetBlockedColor} relays left — remove one to make room for a hint.`);
      return;
    }
    showToast('Every signal is already connected.');
  }

  return (
    <SafeAreaView style={styles.screen}>
      <TopBar
        onBack={() => navigation.goBack()}
        backAccessibilityLabel="Back to drafts"
        eyebrow="DRAFT"
        title={level.title ?? 'Untitled draft'}
        right={<IconButton glyph="⟲" onPress={() => setRelays([])} accessibilityLabel="Reset level" />}
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
            {s.color.charAt(0).toUpperCase() + s.color.slice(1)}: {results[s.color]?.receiverReached ? '✅' : '❌'}
          </Text>
        ))}
      </View>

      <View style={styles.boardArea}>
        <RelayGrid level={level} relays={relays} jammed={jammed} results={results} onCellPress={onCellPress} />
      </View>

      <Text style={styles.legend}>S = source · ◎ = receiver · ● = relay · tap a cell to place / remove</Text>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.hintBtn} activeOpacity={0.75} onPress={onHintPress}>
          <Text style={styles.hintBtnText}>Hint</Text>
        </TouchableOpacity>
      </View>

      <WinOverlay
        visible={showWinOverlay}
        title="Draft solved"
        subtitle="Draft solved — every signal connected within budget."
        nextLabel="Back to drafts"
        onNext={() => navigation.goBack()}
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
  boardArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  legend: { fontSize: 10.5, color: colors.textFaint, paddingHorizontal: 18, textAlign: 'center', fontFamily: fonts.mono, lineHeight: 16 },
  controls: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 6 },
  hintBtn: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingVertical: 13, alignItems: 'center' },
  hintBtnText: { color: colors.text, fontWeight: '600', fontSize: 14 },
});
