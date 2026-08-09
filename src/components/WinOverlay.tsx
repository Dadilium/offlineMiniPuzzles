import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts, radii } from '../theme/colors';
import Confetti from './Confetti';

const DEFAULT_CONFETTI_PALETTE = [colors.signalBlue, colors.signalRed, colors.gold, colors.purple, colors.cyan, colors.pink, colors.success];

interface Props {
  visible: boolean;
  badge: string;
  title: string;
  subtitle: string;
  nextLabel: string;
  onNext: () => void;
  showConfetti?: boolean;
  confettiPalette?: string[];
}

// Deliberately NOT React Native's <Modal> -- navigation.replace while a
// native Modal is still presented is a known crash on iOS (UIKit still has
// the modal on top when react-navigation swaps the screen underneath it).
// Same absolutely-positioned-overlay approach as the original web prototype.
export default function WinOverlay({ visible, badge, title, subtitle, nextLabel, onNext, showConfetti, confettiPalette }: Props) {
  if (!visible) return null;
  return (
    <View style={styles.backdrop} pointerEvents="box-none">
      {showConfetti && <Confetti palette={confettiPalette ?? DEFAULT_CONFETTI_PALETTE} />}
      <View style={styles.card}>
        <Text style={styles.badge}>{badge}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{subtitle}</Text>
        <TouchableOpacity style={styles.button} onPress={onNext} activeOpacity={0.85}>
          <Text style={styles.buttonText}>{nextLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  button: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 18, alignSelf: 'stretch', alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
