import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { DifficultyTier } from '../state/difficultyTiers';
import { fonts, radii } from '../theme/tokens';
import { createThemedStyles } from '../theme/createThemedStyles';
import { useTheme } from '../theme/ThemeProvider';
import Confetti from './Confetti';

interface Props {
  visible: boolean;
  badge: string;
  title: string;
  subtitle: string;
  nextLabel: string;
  onNext: () => void;
  showConfetti?: boolean;
  confettiPalette?: string[];
  /** Set when this win unlocked a harder difficulty (the next level is
   * already generated at it) -- shows an "unlocked" banner on the card. */
  unlockedTier?: DifficultyTier | null;
  /** Marks the unlock as acknowledged once the player moves on. */
  onUnlockSeen?: () => void;
  /** Optional second, quieter action under the main button (the Daily Puzzle's "Done"). */
  secondaryLabel?: string;
  onSecondary?: () => void;
}

// Deliberately NOT React Native's <Modal> -- navigation.replace while a
// native Modal is still presented is a known crash on iOS (UIKit still has
// the modal on top when react-navigation swaps the screen underneath it).
// Same absolutely-positioned-overlay approach as the original web prototype.
export default function WinOverlay({
  visible,
  badge,
  title,
  subtitle,
  nextLabel,
  onNext,
  showConfetti,
  confettiPalette,
  unlockedTier,
  onUnlockSeen,
  secondaryLabel,
  onSecondary,
}: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { t } = useTranslation('common');
  const defaultConfettiPalette = useMemo(
    () => [colors.signalBlue, colors.signalRed, colors.gold, colors.purple, colors.cyan, colors.pink, colors.success],
    [colors]
  );
  if (!visible) return null;
  return (
    <View style={styles.backdrop} pointerEvents="box-none">
      {showConfetti && <Confetti palette={confettiPalette ?? defaultConfettiPalette} />}
      <View style={styles.card}>
        <Text style={styles.badge}>{badge}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{subtitle}</Text>
        {unlockedTier && (
          <Animated.View entering={FadeInDown.delay(350).springify()} style={styles.unlockBanner}>
            <Ionicons name="lock-open" size={16} color={colors.gold} />
            <Text style={styles.unlockText}>{t('difficulty.unlockedBanner', { tier: t(`difficulty.tiers.${unlockedTier}`) })}</Text>
          </Animated.View>
        )}
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            if (unlockedTier) onUnlockSeen?.();
            onNext();
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>{nextLabel}</Text>
        </TouchableOpacity>
        {secondaryLabel && onSecondary && (
          <TouchableOpacity style={styles.secondaryButton} onPress={onSecondary} activeOpacity={0.7}>
            <Text style={styles.secondaryButtonText}>{secondaryLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5,6,10,0.72)', alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    paddingVertical: 26,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '78%',
    zIndex: 2,
  },
  badge: { fontSize: 34, marginBottom: 8 },
  title: { fontFamily: fonts.display, fontWeight: '700', fontSize: 18, color: colors.text, marginBottom: 4, textAlign: 'center' },
  sub: { fontSize: 12.5, color: colors.textDim, marginBottom: 18, textAlign: 'center' },
  unlockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
    marginBottom: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: `${colors.gold}1F`,
  },
  unlockText: { flex: 1, fontSize: 12.5, fontWeight: '600', color: colors.text },
  button: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 18, alignSelf: 'stretch', alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  secondaryButton: { alignSelf: 'stretch', alignItems: 'center', paddingTop: 12, paddingBottom: 2 },
  secondaryButtonText: { color: colors.textDim, fontWeight: '600', fontSize: 13.5 },
}));
