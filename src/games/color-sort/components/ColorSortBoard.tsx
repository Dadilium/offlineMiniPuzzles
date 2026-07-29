import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, TouchableOpacity, View } from 'react-native';
import { colors } from '../../../theme/colors';
import { colorForId } from '../palette';
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
}

/** One color's liquid slot inside a tube -- rises into place with a
 * slightly under-damped spring (a small overshoot) so it reads as liquid
 * settling rather than a block teleporting in. Only the bottom-most slot
 * gets the glass's rounded-bottom radius and only the top-most slot gets a
 * curved "meniscus" top, so a run of same-color slots reads as one
 * continuous column of liquid rather than stacked bricks. */
function Unit({ colorId, width, height, isBottom, isTop }: UnitProps) {
  const grow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(grow, { toValue: height, friction: 7, tension: 260, useNativeDriver: false }).start();
    // Mount-only: this slot's target height never changes after it lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      style={[
        styles.unit,
        {
          width,
          height: grow,
          backgroundColor: colorForId(colorId),
          borderBottomLeftRadius: isBottom ? width * BOTTOM_RADIUS_FACTOR : 0,
          borderBottomRightRadius: isBottom ? width * BOTTOM_RADIUS_FACTOR : 0,
          borderTopLeftRadius: isTop ? height * 0.55 : 0,
          borderTopRightRadius: isTop ? height * 0.55 : 0,
        },
      ]}
    >
      {isTop && <View style={styles.unitSheen} />}
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
  onPress: () => void;
}

function TubeView({ index, tube, capacity, layout, selected, highlighted, shake, solved, tiltDir, isPourDest, onPress }: TubeProps) {
  const { tubeW, unitH } = layout;
  const tubeH = unitH * (capacity + 1.1);
  const lift = useRef(new Animated.Value(0)).current;
  const shakeX = useRef(new Animated.Value(0)).current;
  const tilt = useRef(new Animated.Value(0)).current;
  const squash = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(lift, { toValue: selected ? 1 : 0, friction: 6, tension: 220, useNativeDriver: true }).start();
  }, [selected, lift]);

  useEffect(() => {
    if (!shake) return;
    Animated.sequence([
      Animated.timing(shakeX, { toValue: 1, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -1, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 1, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0, duration: 45, useNativeDriver: true }),
    ]).start();
  }, [shake, shakeX]);

  // The "pouring" gesture cue: the source tube tips toward the destination
  // and rights itself once the pour has landed; the destination gets a
  // little compression bounce as the liquid arrives.
  useEffect(() => {
    if (tiltDir === 0) {
      tilt.setValue(0);
      return;
    }
    Animated.sequence([
      Animated.timing(tilt, { toValue: tiltDir, duration: 140, useNativeDriver: true }),
      Animated.timing(tilt, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [tiltDir, tilt]);

  useEffect(() => {
    if (!isPourDest) return;
    squash.setValue(0.92);
    Animated.spring(squash, { toValue: 1, friction: 5, tension: 220, useNativeDriver: true }).start();
  }, [isPourDest, squash]);

  const ringColor = highlighted ? colors.gold : selected ? colors.accentBright : solved ? colors.success : colors.borderSoft;
  const ringWidth = selected || highlighted ? 2.2 : solved ? 1.8 : 1.3;
  const unitWidth = tubeW - tubeW * 0.22;

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={{ width: tubeW + 10 }}>
      <Animated.View
        style={[
          styles.bottleWrap,
          {
            transform: [
              { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) },
              { translateX: shakeX.interpolate({ inputRange: [-1, 0, 1], outputRange: [-5, 0, 5] }) },
              { rotate: tilt.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-10deg', '0deg', '10deg'] }) },
              { scaleY: squash },
            ],
          },
        ]}
      >
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
              <Unit key={`${index}-${u}`} colorId={colorId} width={unitWidth} height={unitH} isBottom={u === 0} isTop={u === tube.length - 1} />
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
  onTubePress: (index: number) => void;
}

export default function ColorSortBoard({ tubes, capacity, selected, hint, shakeTube, pouring, onTubePress }: Props) {
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
  unit: {},
  unitSheen: {
    position: 'absolute',
    top: 2,
    left: '12%',
    right: '12%',
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.35)',
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
