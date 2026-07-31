import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/colors';
import TopBar from './TopBar';

interface Props {
  onBack: () => void;
  backAccessibilityLabel?: string;
  eyebrow?: string;
  title?: string;
  headerRight?: React.ReactNode;
  statusRow?: React.ReactNode;
  children: React.ReactNode;
  /** Board needs to scroll when it can exceed the viewport (e.g. large grids). */
  boardScrollable?: boolean;
  legend?: string;
  controls?: React.ReactNode;
  /** Rendered last, inside the same SafeAreaView, so its absolute-position
   * overlay covers the whole screen -- see each game's WinOverlay usage. */
  winOverlay?: React.ReactNode;
}

/** Shared screen shell used by every game's GameScreen: TopBar, a status
 * row, the board area, a legend line, and bottom controls. Each game keeps
 * all its own state/logic and just fills in these slots. */
export default function GameScreenLayout({
  onBack,
  backAccessibilityLabel,
  eyebrow,
  title,
  headerRight,
  statusRow,
  children,
  boardScrollable,
  legend,
  controls,
  winOverlay,
}: Props) {
  return (
    <SafeAreaView style={styles.screen}>
      <TopBar onBack={onBack} backAccessibilityLabel={backAccessibilityLabel} eyebrow={eyebrow} title={title} right={headerRight} />

      {statusRow && <View style={styles.statusRow}>{statusRow}</View>}

      {boardScrollable ? (
        <ScrollView style={styles.boardAreaScroll} contentContainerStyle={styles.boardAreaScrollContent}>
          {children}
        </ScrollView>
      ) : (
        <View style={styles.boardArea}>{children}</View>
      )}

      {legend ? <Text style={styles.legend}>{legend}</Text> : null}

      {controls && <View style={styles.controls}>{controls}</View>}

      {winOverlay}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDeep },
  statusRow: { flexDirection: 'row', gap: 14, flexWrap: 'wrap', paddingHorizontal: 18, paddingTop: 8, justifyContent: 'center' },
  // Takes up all remaining vertical space between the status row and the
  // bottom controls, so the board is always centered and Hint always sits
  // at the very bottom of the screen -- regardless of board size.
  boardArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  boardAreaScroll: { flex: 1 },
  boardAreaScrollContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 12 },
  legend: {
    fontSize: 10.5,
    color: colors.textFaint,
    paddingHorizontal: 18,
    textAlign: 'center',
    fontFamily: fonts.mono,
    lineHeight: 16,
  },
  controls: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 6, gap: 8 },
});
