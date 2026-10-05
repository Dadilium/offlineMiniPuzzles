import React, { useEffect, useState } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { isTierUnlocked, type DifficultyTier } from '../state/difficultyTiers';
import { fonts, radii } from '../theme/tokens';
import { createThemedStyles } from '../theme/createThemedStyles';
import { useTheme } from '../theme/ThemeProvider';

const TRACK_PADDING = 3;
const BAR_WIDTH = 5;
const BAR_GAP = 3;
/** Shortest bar; each one after it grows by `BAR_STEP` -- one bar per tier the game offers. */
const BAR_MIN_HEIGHT = 7;
const BAR_STEP = 4;
const SPRING = { duration: 260, dampingRatio: 0.8 };
/** Time the fresh-unlock pulse plays before it's marked as seen. */
const UNLOCK_PULSE_MS = 1400;

export interface DifficultySelectorProps {
  /** Tiers to show, easiest first. */
  tiers: readonly DifficultyTier[];
  selectedTier: DifficultyTier;
  unlockedTier: DifficultyTier;
  hasNewUnlock: boolean;
  onSelect: (tier: DifficultyTier) => void;
  onLockedPress: (tier: DifficultyTier) => void;
  onUnlockSeen: () => void;
}

interface Props extends DifficultySelectorProps {
  accentColor: string;
}

/** One bar of the "signal strength" icon: lit while its rank is at or below
 * the selected tier, with the fill sweeping as `progress` springs between ranks. */
function SignalBar({ index, progress, accentColor, idleColor }: { index: number; progress: SharedValue<number>; accentColor: string; idleColor: string }) {
  const style = useAnimatedStyle(() => {
    const lit = interpolate(progress.value, [index - 1, index], [0, 1], 'clamp');
    return {
      backgroundColor: lit > 0.5 ? accentColor : idleColor,
      opacity: 0.45 + lit * 0.55,
      transform: [{ scaleY: 0.8 + lit * 0.2 }],
    };
  });
  return <Animated.View style={[{ width: BAR_WIDTH, height: BAR_MIN_HEIGHT + index * BAR_STEP, borderRadius: 2 }, style]} />;
}

interface SegmentProps {
  selected: boolean;
  locked: boolean;
  pulse: boolean;
  label: string;
  a11yLabel: string;
  onPress: () => void;
}

function Segment({ selected, locked, pulse, label, a11yLabel, onPress }: SegmentProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!pulse) return;
    scale.value = withSequence(withTiming(1.12, { duration: 220 }), withSpring(1, SPRING), withTiming(1.08, { duration: 200 }), withSpring(1, SPRING));
  }, [pulse, scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const textColor = selected ? colors.text : locked ? colors.textFaint : colors.textDim;

  return (
    <Pressable
      style={styles.segment}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ selected, disabled: locked }}
      hitSlop={{ top: 6, bottom: 6 }}
    >
      <Animated.View style={[styles.segmentInner, animatedStyle]}>
        {locked && <Ionicons name="lock-closed" size={11} color={textColor} style={styles.lockIcon} />}
        {/* Five tiers (Arrows) leave narrow segments -- shrink long labels rather than truncate them. */}
        <Text
          style={[styles.segmentText, { color: textColor }, selected && styles.segmentTextSelected]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/** Hub difficulty picker: a signal-bars icon + tier name on top of a
 * segmented track (one step per tier the game offers) whose highlight springs to the selected step.
 * Locked steps stay visible (dimmed, with a lock) so there's always a next
 * goal in sight; a freshly unlocked step pulses once. */
export default function DifficultySelector({
  tiers,
  selectedTier,
  unlockedTier,
  hasNewUnlock,
  onSelect,
  onLockedPress,
  onUnlockSeen,
  accentColor,
}: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { t } = useTranslation('common');
  const [trackWidth, setTrackWidth] = useState(0);
  const selectedRank = Math.max(0, tiers.indexOf(selectedTier));
  const progress = useSharedValue(selectedRank);
  const iconBounce = useSharedValue(1);

  useEffect(() => {
    progress.value = withSpring(selectedRank, SPRING);
    iconBounce.value = withSequence(withTiming(1.15, { duration: 120 }), withSpring(1, SPRING));
  }, [selectedRank, progress, iconBounce]);

  useEffect(() => {
    if (!hasNewUnlock) return undefined;
    const timer = setTimeout(onUnlockSeen, UNLOCK_PULSE_MS);
    return () => clearTimeout(timer);
  }, [hasNewUnlock, onUnlockSeen]);

  const segmentWidth = trackWidth > 0 ? (trackWidth - TRACK_PADDING * 2) / tiers.length : 0;
  const thumbStyle = useAnimatedStyle(() => ({
    width: segmentWidth,
    transform: [{ translateX: progress.value * segmentWidth }],
  }));
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: iconBounce.value }] }));

  function handlePress(tier: DifficultyTier) {
    if (!isTierUnlocked(tier, unlockedTier)) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      onLockedPress(tier);
      return;
    }
    if (tier === selectedTier) return;
    void Haptics.selectionAsync();
    onSelect(tier);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Animated.View style={[styles.bars, iconStyle]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {tiers.map((_, i) => (
            <SignalBar key={i} index={i} progress={progress} accentColor={accentColor} idleColor={colors.surface3} />
          ))}
        </Animated.View>
        <Text style={styles.headerLabel}>{t('difficulty.label')}</Text>
        <Text style={[styles.headerTier, { color: accentColor }]}>{t(`difficulty.tiers.${selectedTier}`)}</Text>
      </View>

      <View
        style={styles.track}
        accessibilityRole="tablist"
        onLayout={(e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width)}
      >
        {segmentWidth > 0 && (
          <Animated.View style={[styles.thumb, { borderColor: accentColor, backgroundColor: `${accentColor}26` }, thumbStyle]} />
        )}
        {tiers.map((tier) => {
          const locked = !isTierUnlocked(tier, unlockedTier);
          const label = t(`difficulty.tiers.${tier}`);
          return (
            <Segment
              key={tier}
              selected={tier === selectedTier}
              locked={locked}
              pulse={hasNewUnlock && tier === unlockedTier}
              label={label}
              a11yLabel={t(locked ? 'difficulty.lockedA11y' : 'difficulty.unlockedA11y', { tier: label })}
              onPress={() => handlePress(tier)}
            />
          );
        })}
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  container: { marginHorizontal: 20, marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 8, gap: 8 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: BAR_GAP },
  headerLabel: { fontSize: 12.5, color: colors.textDim, fontWeight: '500' },
  headerTier: { fontFamily: fonts.display, fontSize: 13, fontWeight: '700' },
  track: {
    flexDirection: 'row',
    padding: TRACK_PADDING,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radii.md,
  },
  thumb: {
    position: 'absolute',
    top: TRACK_PADDING,
    bottom: TRACK_PADDING,
    left: TRACK_PADDING,
    borderWidth: 1,
    borderRadius: radii.md - TRACK_PADDING,
  },
  segment: { flex: 1, paddingVertical: 9 },
  segmentInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  lockIcon: { marginRight: 4 },
  segmentText: { flexShrink: 1, fontSize: 13, fontWeight: '500' },
  segmentTextSelected: { fontWeight: '700' },
}));
