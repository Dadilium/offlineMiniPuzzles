import React, { useRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Animated, Easing, Text, TouchableWithoutFeedback, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { createThemedStyles } from '../theme/createThemedStyles';
import { useTheme } from '../theme/ThemeProvider';
import { darken } from '../theme/colorUtils';

const SIZE = 56;
const PRESS_DEPTH = 6;
const ICON_SIZE = 30;
const BADGE_SIZE = 22;

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  caption: string;
  accessibilityLabel: string;
  onPress: () => void;
  /** The game's own theme color (the same one behind its hub banner dots),
   * so every action button reads as belonging to that game. */
  accentColor: string;
  /** A number renders a small count pill; `'ad'` renders a video-camera icon
   * for actions gated behind a rewarded ad; omit for no badge. */
  badge?: number | 'ad';
  hidden?: boolean;
  /** Dims and disables the button while keeping it visible -- for actions
   * that are legal but currently have nothing to act on (e.g. undo with an
   * empty history), as opposed to `hidden` which hides it entirely. */
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Round bottom-of-screen action button used by every game's GameScreen: a
 * two-layer "toy" circle (a raised top disc over a solid base) that squishes
 * down on press, with a short caption pill touching its bottom edge and an
 * optional badge (a count, or an ad indicator) in the corner. `hidden` keeps
 * the layout slot reserved (opacity 0) instead of unmounting, for screens
 * where controls shouldn't reflow on solve. */
function GameActionButton({
  icon,
  caption,
  accessibilityLabel,
  onPress,
  accentColor,
  badge,
  hidden,
  disabled,
  style,
}: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const translateY = useRef(new Animated.Value(0)).current;
  const interactive = !hidden && !disabled;
  const baseColor = darken(accentColor, 0.55);

  function press() {
    Animated.timing(translateY, {
      toValue: PRESS_DEPTH,
      duration: 60,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true,
    }).start();
  }

  function release() {
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 10 }).start();
  }

  return (
    <TouchableWithoutFeedback
      accessibilityLabel={accessibilityLabel}
      onPress={interactive ? onPress : undefined}
      onPressIn={interactive ? press : undefined}
      onPressOut={interactive ? release : undefined}
      disabled={!interactive}
    >
      <View style={[styles.wrap, hidden && styles.hidden, disabled && styles.disabled, style]}>
        <View style={styles.stage}>
          <View style={[styles.base, { backgroundColor: baseColor }]} />
          <Animated.View style={[styles.top, { borderColor: accentColor, transform: [{ translateY }] }]}>
            <Ionicons name={icon} size={ICON_SIZE} color={accentColor} />
            {badge !== undefined && (
              <View style={[styles.badge, badge === 'ad' && styles.badgeAd]}>
                {badge === 'ad' ? (
                  <Ionicons name="videocam" size={10} color={colors.bgDeep} />
                ) : (
                  <Text style={styles.badgeText}>{badge}</Text>
                )}
              </View>
            )}
          </Animated.View>
        </View>
        <Text style={styles.caption}>{caption}</Text>
      </View>
    </TouchableWithoutFeedback>
  );
}

interface CommonPresetProps {
  onPress: () => void;
  accentColor: string;
  hidden?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

interface HintProps extends CommonPresetProps {
  /** Hints left in the wallet; 0 renders the ad badge instead of a count. */
  hintCount: number;
}

/** Hint action: fixed "bulb" icon, badge switches between the remaining
 * count and the ad indicator once the wallet is empty. */
function Hint({ hintCount, ...rest }: HintProps) {
  const { t: tc } = useTranslation('common');
  return (
    <GameActionButton
      icon="bulb"
      caption={tc('actions.hint')}
      accessibilityLabel={tc('actions.hintWithCount', { count: hintCount })}
      badge={hintCount > 0 ? hintCount : 'ad'}
      {...rest}
    />
  );
}

/** Skip-level action: fixed "play-skip-forward" icon, always ad-gated. */
function Skip(props: CommonPresetProps) {
  const { t: tc } = useTranslation('common');
  return (
    <GameActionButton
      icon="play-skip-forward"
      caption={tc('actions.skip')}
      accessibilityLabel={tc('actions.skipLevelAd')}
      badge="ad"
      {...props}
    />
  );
}

/** Undo action: fixed "arrow-undo" icon, no badge -- pass `disabled` when
 * there's nothing to undo. */
function Undo(props: CommonPresetProps) {
  const { t: tc } = useTranslation('common');
  return <GameActionButton icon="arrow-undo" caption={tc('actions.undo')} accessibilityLabel={tc('actions.undoMove')} {...props} />;
}

interface AddNumbersProps extends CommonPresetProps {
  /** How many "add numbers" uses are left this level -- rendered as the badge. */
  remaining: number;
  /** Per-game copy -- unlike the other presets this action isn't in the
   * shared `common` namespace, so the caller supplies its own translation. */
  caption: string;
  accessibilityLabel: string;
}

/** Add-numbers action: fixed "add-circle" icon, badge is the remaining-uses count. */
function AddNumbers({ remaining, caption, accessibilityLabel, ...rest }: AddNumbersProps) {
  return <GameActionButton icon="add-circle" caption={caption} accessibilityLabel={accessibilityLabel} badge={remaining} {...rest} />;
}

type GameActionButtonWithPresets = typeof GameActionButton & {
  Hint: typeof Hint;
  Skip: typeof Skip;
  Undo: typeof Undo;
  AddNumbers: typeof AddNumbers;
};

const GameActionButtonExport = GameActionButton as GameActionButtonWithPresets;
GameActionButtonExport.Hint = Hint;
GameActionButtonExport.Skip = Skip;
GameActionButtonExport.Undo = Undo;
GameActionButtonExport.AddNumbers = AddNumbers;

export default GameActionButtonExport;

const useStyles = createThemedStyles((colors) => ({
  wrap: { alignItems: 'center', width: SIZE + 12 },
  hidden: { opacity: 0 },
  stage: { width: SIZE, height: SIZE + PRESS_DEPTH },
  base: {
    position: 'absolute',
    top: PRESS_DEPTH,
    left: 0,
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
  },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: colors.surface2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  caption: {
    marginTop: 5,
    color: colors.textDim,
    fontWeight: '600',
    fontSize: 11,
    textAlign: 'center',
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: colors.gold,
    borderWidth: 2,
    borderColor: colors.bgDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeAd: { backgroundColor: colors.gold },
  badgeText: { color: colors.text, fontWeight: '700', fontSize: 10 },
}));
