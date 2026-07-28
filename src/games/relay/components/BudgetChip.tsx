import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts } from '../../../theme/colors';
import type { SignalColor } from '../types';

const SIGNAL_COLORS: Record<SignalColor, string> = { blue: colors.signalBlue, red: colors.signalRed };

interface Props {
  color: SignalColor;
  used: number;
  budget: number;
  active: boolean;
  selectable: boolean;
  onPress: () => void;
}

export default function BudgetChip({ color, used, budget, active, selectable, onPress }: Props) {
  const tint = SIGNAL_COLORS[color];
  const label = color.charAt(0).toUpperCase() + color.slice(1);
  return (
    <TouchableOpacity
      disabled={!selectable}
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.chip, active && { borderColor: tint }]}
    >
      <View style={[styles.dot, { backgroundColor: tint }]} />
      <Text style={[styles.label, active && { color: colors.text }]}>
        {label} {used}/{budget}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surface2,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontFamily: fonts.mono, fontSize: 11.5, fontWeight: '600', color: colors.textDim },
});
