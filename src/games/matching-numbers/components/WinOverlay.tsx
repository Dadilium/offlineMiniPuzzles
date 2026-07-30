import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts, radii } from '../../../theme/colors';
import Confetti from './Confetti';

interface Props {
  visible: boolean;
  showConfetti: boolean;
  title: string;
  subtitle: string;
  nextLabel: string;
  onNext: () => void;
}

// Deliberately NOT React Native's <Modal> -- navigation.replace while a
// native Modal is presented is a known iOS crash (see Kings/Relay's
// WinOverlay.tsx). Same absolutely-positioned-overlay approach here.
export default function WinOverlay({ visible, showConfetti, title, subtitle, nextLabel, onNext }: Props) {
  if (!visible) return null;
  return (
    <View style={styles.backdrop} pointerEvents="box-none">
      {showConfetti && <Confetti />}
      <View style={styles.card}>
        <Text style={styles.badge}>🔢</Text>
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
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,6,10,0.72)', alignItems: 'center', justifyContent: 'center', zIndex: 50 },
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
  title: { fontFamily: fonts.display, fontWeight: '700', fontSize: 18, color: colors.text, marginBottom: 4 },
  sub: { fontSize: 12.5, color: colors.textDim, marginBottom: 18, textAlign: 'center' },
  button: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 18, alignSelf: 'stretch', alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
