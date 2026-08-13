import React from 'react';
import { LayoutChangeEvent, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createThemedStyles } from '../theme/createThemedStyles';
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
  /** Vertical alignment within the board area. Defaults to 'center'. Use
   * 'top' for a board that pads itself out with filler content to always
   * fill the measured height (e.g. Matching Numbers) -- centering a board
   * like that only affects the first frame, before the real height from
   * onBoardAreaLayout lands, and produces a jarring center-then-top-jump. */
  boardAreaAlign?: 'center' | 'top';
  /** Fires with the board area's rendered height -- lets a game compute how
   * much vertical space its board actually has to work with (e.g. Matching
   * Numbers padding a fixed-width board out with placeholder rows). */
  onBoardAreaLayout?: (height: number) => void;
  controls?: React.ReactNode;
  /** Rendered last, inside the same top-inset-padded container, so its absolute-position
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
  boardAreaAlign = 'center',
  onBoardAreaLayout,
  controls,
  winOverlay,
}: Props) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const handleBoardAreaLayout = onBoardAreaLayout ? (e: LayoutChangeEvent) => onBoardAreaLayout(e.nativeEvent.layout.height) : undefined;
  const alignTop = boardAreaAlign === 'top';

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <TopBar onBack={onBack} backAccessibilityLabel={backAccessibilityLabel} eyebrow={eyebrow} title={title} right={headerRight} />

      {boardScrollable ? (
        <ScrollView
          style={styles.boardAreaScroll}
          contentContainerStyle={[styles.boardAreaScrollContent, alignTop && styles.boardAreaScrollContentTop]}
          onLayout={handleBoardAreaLayout}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.boardArea, alignTop && styles.boardAreaTop]} onLayout={handleBoardAreaLayout}>
          {children}
        </View>
      )}

      {controls && <View style={styles.controls}>{controls}</View>}

      {winOverlay}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bgDeep },
  // Takes up all remaining vertical space between the header and the
  // bottom controls, so the board is always centered and Hint always sits
  // at the very bottom of the screen -- regardless of board size.
  boardArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  boardAreaTop: { justifyContent: 'flex-start' },
  boardAreaScroll: { flex: 1 },
  boardAreaScrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: BOARD_AREA_VERTICAL_PADDING,
    paddingHorizontal: 12,
  },
  boardAreaScrollContentTop: { justifyContent: 'flex-start' },
  controls: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 6, gap: 8 },
}));
