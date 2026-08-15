import React, { useEffect } from 'react';
import { Dimensions, StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme/ThemeProvider';
import { colorForId, iconForId } from '../palette';
import type { Tube } from '../types';

const MIN_TUBE_W = 40;
const MAX_TUBE_W = 58;
const H_GAP = 16;
const V_GAP = 24;
// Rough non-board chrome (top bar, status row, legend, controls, safe areas).
const CHROME_ESTIMATE = 300;
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface Layout {
  tubeW: number;
  unitH: number;
  perRow: number;
}

/**
 * Real boards are always 6-12 tubes (starter tier's minimum is 4 colors + 2
 * empty), so this always balances across 2 rows rather than packing as many
 * as fit in one -- e.g. 7 tubes -> 4+3, 12 -> 6+6, never a single row that
 * runs off-screen. The extra row also means each tube can render bigger.
 */
function layoutFor(tubeCount: number, capacity: number): Layout {
  const rows = tubeCount >= 6 ? 2 : 1;
  const perRow = Math.ceil(tubeCount / rows);
  const widthBudget = Math.floor((screenWidth - 32 - H_GAP * (perRow - 1)) / perRow);
  const tubeW = Math.max(MIN_TUBE_W, Math.min(MAX_TUBE_W, widthBudget));
  // Extra 0.55 units of headroom above a full tube's liquid, so the glass
  // always shows visible open space at the top instead of looking crammed.
  const heightBudgetPerUnit = Math.floor((screenHeight - CHROME_ESTIMATE) / rows / (capacity + 1.1));
  const unitH = Math.max(19, Math.min(28, heightBudgetPerUnit, tubeW * 0.58));
  return { tubeW, unitH, perRow };
}

const BOTTOM_RADIUS_FACTOR = 0.46;
const TOP_RADIUS_FACTOR = 0.14;

interface UnitProps {
  colorId: number;
  width: number;
  height: number;
  isBottom: boolean;
  isTop: boolean;
  showIcon: boolean;
}

/** One color's liquid slot inside a tube -- rises into place with a
 * slightly under-damped spring (a small overshoot) so it reads as liquid
 * settling rather than a block teleporting in. Only the bottom-most slot
 * gets the glass's rounded-bottom radius and only the top-most slot gets a
 * curved "meniscus" top, so a run of same-color slots reads as one
 * continuous column of liquid rather than stacked bricks. */
function Unit({ colorId, width, height, isBottom, isTop, showIcon }: UnitProps) {
  const grow = useSharedValue(0);

  useEffect(() => {
    grow.value = withSpring(height, { duration: 300, dampingRatio: 0.75 });
    // Mount-only: this slot's target height never changes after it lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const growStyle = useAnimatedStyle(() => ({ height: grow.value }));

  return (
    <Animated.View
      style={[
        styles.unit,
        {
          width,
          backgroundColor: colorForId(colorId),
          borderBottomLeftRadius: isBottom ? width * BOTTOM_RADIUS_FACTOR : 0,
          borderBottomRightRadius: isBottom ? width * BOTTOM_RADIUS_FACTOR : 0,
          borderTopLeftRadius: isTop ? height * 0.55 : 0,
          borderTopRightRadius: isTop ? height * 0.55 : 0,
        },
        growStyle,
      ]}
    >
      {isTop && <View style={styles.unitSheen} />}
      {showIcon && (
        // White + dark shadow reads on every hue in the palette (light gold
        // as much as dark indigo) without needing a per-color text-color
        // decision -- see palette.ts's colorblind-mode comment for why the
        // shape itself is never color-coded.
        <Ionicons name={iconForId(colorId)} size={Math.min(width, height) * 0.62} color="#fff" style={styles.unitIcon} />
      )}
    </Animated.View>
  );
}

interface TubeProps {
  index: number;
  tube: Tube;
  capacity: number;
  layout: Layout;
  selected: boolean;
  highlighted: boolean;
  shake: boolean;
  solved: boolean;
  tiltDir: 1 | -1 | 0;
  isPourDest: boolean;
  showIcons: boolean;
  onPress: () => void;
}

function TubeView({ index, tube, capacity, layout, selected, highlighted, shake, solved, tiltDir, isPourDest, showIcons, onPress }: TubeProps) {
  const { colors } = useTheme();
  const { tubeW, unitH } = layout;
  const tubeH = unitH * (capacity + 1.1);
  const lift = useSharedValue(0);
  const shakeX = useSharedValue(0);
  const tilt = useSharedValue(0);
  const squash = useSharedValue(1);

  useEffect(() => {
    lift.value = withSpring(selected ? 1 : 0, { duration: 220, dampingRatio: 0.6 });
  }, [selected, lift]);

  useEffect(() => {
    if (!shake) return;
    shakeX.value = withSequence(
      withTiming(1, { duration: 45 }),
      withTiming(-1, { duration: 45 }),
      withTiming(1, { duration: 45 }),
      withTiming(0, { duration: 45 })
    );
  }, [shake, shakeX]);

  // The "pouring" gesture cue: the source tube tips toward the destination
  // and rights itself once the pour has landed; the destination gets a
  // little compression bounce as the liquid arrives.
  useEffect(() => {
    if (tiltDir === 0) {
      tilt.value = 0;
      return;
    }
    tilt.value = withSequence(withTiming(tiltDir, { duration: 140 }), withTiming(0, { duration: 220 }));
  }, [tiltDir, tilt]);

  useEffect(() => {
    if (!isPourDest) return;
    squash.value = 0.92;
    squash.value = withSpring(1, { duration: 200, dampingRatio: 0.6 });
  }, [isPourDest, squash]);

  const ringColor = highlighted ? colors.gold : selected ? colors.accentBright : solved ? colors.success : colors.borderSoft;
  const ringWidth = selected || highlighted ? 2.2 : solved ? 1.8 : 1.3;
  const unitWidth = tubeW - tubeW * 0.22;

  const bottleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(lift.value, [0, 1], [0, -8]) },
      { translateX: interpolate(shakeX.value, [-1, 0, 1], [-5, 0, 5]) },
      { rotate: `${interpolate(tilt.value, [-1, 0, 1], [-10, 0, 10])}deg` },
      { scaleY: squash.value },
    ],
  }));

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={{ width: tubeW + 10 }}>
      <Animated.View style={[styles.bottleWrap, bottleAnimatedStyle]}>
        <View style={[styles.rim, { width: tubeW * 0.86, backgroundColor: ringColor }]} />
        <View
          style={[
            styles.tubeOuter,
            {
              width: tubeW,
              height: tubeH,
              borderColor: ringColor,
              borderWidth: ringWidth,
              borderBottomLeftRadius: tubeW * BOTTOM_RADIUS_FACTOR,
              borderBottomRightRadius: tubeW * BOTTOM_RADIUS_FACTOR,
              borderTopLeftRadius: tubeW * TOP_RADIUS_FACTOR,
              borderTopRightRadius: tubeW * TOP_RADIUS_FACTOR,
            },
          ]}
        >
          <View pointerEvents="none" style={[styles.glassShine, { left: tubeW * 0.14 }]} />
          <View style={styles.tubeInner}>
            {tube.map((colorId, u) => (
              <Unit
                key={`${index}-${u}`}
                colorId={colorId}
                width={unitWidth}
                height={unitH}
                isBottom={u === 0}
                isTop={u === tube.length - 1}
                showIcon={showIcons}
              />
            ))}
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

function isSolvedTube(tube: Tube, capacity: number): boolean {
  return tube.length === capacity && tube.every((c) => c === tube[0]);
}

interface Props {
  tubes: Tube[];
  capacity: number;
  selected: number | null;
  hint: { from: number; to: number } | null;
  shakeTube: number | null;
  pouring: { from: number; to: number } | null;
  /** Colorblind-friendly mode: overlays a shape icon on every unit so tubes
   * can be matched without relying on hue at all -- see palette.ts. */
  showIcons: boolean;
  onTubePress: (index: number) => void;
}

export default function ColorSortBoard({ tubes, capacity, selected, hint, shakeTube, pouring, showIcons, onTubePress }: Props) {
  const layout = layoutFor(tubes.length, capacity);
  const rowSize = layout.perRow;

  const rows: Tube[][] = [];
  for (let i = 0; i < tubes.length; i += rowSize) rows.push(tubes.slice(i, i + rowSize));

  function tiltDirFor(index: number): 1 | -1 | 0 {
    if (!pouring || pouring.from !== index) return 0;
    return pouring.to > pouring.from ? 1 : -1;
  }

  return (
    <View style={styles.wrap}>
      {rows.map((row, rowIdx) => (
        <View key={rowIdx} style={[styles.row, { gap: H_GAP }]}>
          {row.map((tube, colIdx) => {
            const index = rowIdx * rowSize + colIdx;
            return (
              <TubeView
                key={index}
                index={index}
                tube={tube}
                capacity={capacity}
                layout={layout}
                selected={selected === index}
                highlighted={!!hint && (hint.from === index || hint.to === index)}
                shake={shakeTube === index}
                solved={isSolvedTube(tube, capacity)}
                tiltDir={tiltDirFor(index)}
                isPourDest={!!pouring && pouring.to === index}
                showIcons={showIcons}
                onPress={() => onTubePress(index)}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: V_GAP },
  row: { flexDirection: 'row' },
  bottleWrap: { alignItems: 'center' },
  rim: { height: 5, borderRadius: 3, marginBottom: -1, zIndex: 1 },
  tubeOuter: {
    backgroundColor: 'rgba(27,32,44,0.55)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  tubeInner: { flexDirection: 'column-reverse', alignItems: 'center', paddingBottom: 3 },
  unit: { alignItems: 'center', justifyContent: 'center' },
  unitSheen: {
    position: 'absolute',
    top: 2,
    left: '12%',
    right: '12%',
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  unitIcon: {
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  glassShine: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    width: '16%',
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
});
