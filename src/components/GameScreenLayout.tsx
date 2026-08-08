import React from 'react';
import { LayoutChangeEvent, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import TopBar from './TopBar';

/** Vertical padding applied inside the scrollable board area -- exported so a
 * game that measures `onBoardAreaLayout` can subtract it back out to get the
 * actual usable height for its content. */
export const BOARD_AREA_VERTICAL_PADDING = 12;

interface Props {
  onBack: () => void;
  backAccessibilityLabel?: string;
  eyebrow?: string;
  title?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  /** Board needs to scroll when it can exceed the viewport (e.g. large grids). */
  boardScrollable?: boolean;
  /** Fires with the board area's rendered height -- lets a game compute how
   * much vertical space its board actually has to work with (e.g. Matching
   * Numbers padding a fixed-width board out with placeholder rows). */
  onBoardAreaLayout?: (height: number) => void;
  controls?: React.ReactNode;
  /** Rendered last, inside the same SafeAreaView, so its absolute-position
   * overlay covers the whole screen -- see each game's WinOverlay usage. */
  winOverlay?: React.ReactNode;
}

/** Shared screen shell used by every game's GameScreen: TopBar, the board
 * area, and bottom controls. Each game keeps all its own state/logic and
 * just fills in these slots. */
export default function GameScreenLayout({
  onBack,
  backAccessibilityLabel,
  eyebrow,
  title,
  headerRight,
  children,
  boardScrollable,
  onBoardAreaLayout,
  controls,
  winOverlay,
}: Props) {
  const handleBoardAreaLayout = onBoardAreaLayout ? (e: LayoutChangeEvent) => onBoardAreaLayout(e.nativeEvent.layout.height) : undefined;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <TopBar onBack={onBack} backAccessibilityLabel={backAccessibilityLabel} eyebrow={eyebrow} title={title} right={headerRight} />

      {boardScrollable ? (
        <ScrollView style={styles.boardAreaScroll} contentContainerStyle={styles.boardAreaScrollContent} onLayout={handleBoardAreaLayout}>
          {children}
        </ScrollView>
      ) : (
        <View style={styles.boardArea} onLayout={handleBoardAreaLayout}>
          {children}
        </View>
      )}

      {controls && <View style={styles.controls}>{controls}</View>}

      {winOverlay}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDeep },
  // Takes up all remaining vertical space between the header and the
  // bottom controls, so the board is always centered and Hint always sits
  // at the very bottom of the screen -- regardless of board size.
  boardArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  boardAreaScroll: { flex: 1 },
  boardAreaScrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: BOARD_AREA_VERTICAL_PADDING,
    paddingHorizontal: 12,
  },
  controls: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 6, gap: 8 },
});
