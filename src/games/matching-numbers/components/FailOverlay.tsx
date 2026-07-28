import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts, radii } from '../../../theme/colors';

interface Props {
  visible: boolean;
  onRetry: () => void;
  onSkip: () => void;
}

// Same non-Modal overlay pattern as WinOverlay (see its comment) -- a
// red/warn-tinted variant with no confetti, shown when the board has no
// legal move left and Add Numbers is exhausted.
export default function FailOverlay({ visible, onRetry, onSkip }: Props) {
  if (!visible) return null;
  return (
    <View style={styles.backdrop} pointerEvents="box-none">
      <View style={styles.card}>
        <Text style={styles.badge}>🧮</Text>
        <Text style={styles.title}>No matches left</Text>
        <Text style={styles.sub}>You're out of Add Numbers and there's no legal move on the board.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.85}>
          <Text style={styles.retryButtonText}>Retry level</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.skipButton} onPress={onSkip} activeOpacity={0.75}>
          <Text style={styles.skipButtonText}>Skip level (watch an ad)</Text>
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
    borderColor: colors.signalRed,
    borderRadius: radii.xl,
    paddingVertical: 26,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '80%',
    zIndex: 2,
  },
  badge: { fontSize: 34, marginBottom: 8 },
  title: { fontFamily: fonts.display, fontWeight: '700', fontSize: 18, color: colors.text, marginBottom: 4 },
  sub: { fontSize: 12.5, color: colors.textDim, marginBottom: 18, textAlign: 'center' },
  retryButton: {
    backgroundColor: colors.signalRed,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 18,
    alignSelf: 'stretch',
    alignItems: 'center',
    marginBottom: 8,
  },
  retryButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  skipButton: { paddingVertical: 8, alignItems: 'center' },
  skipButtonText: { color: colors.textFaint, fontWeight: '600', fontSize: 12 },
});
