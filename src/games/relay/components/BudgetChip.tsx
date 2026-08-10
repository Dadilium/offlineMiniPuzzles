import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '../../../theme/tokens';
import { useTheme } from '../../../theme/ThemeProvider';
import { createThemedStyles } from '../../../theme/createThemedStyles';
import type { SignalColor } from '../types';

interface Props {
  color: SignalColor;
  used: number;
  budget: number;
  active: boolean;
  selectable: boolean;
  onPress: () => void;
}

export default function BudgetChip({ color, used, budget, active, selectable, onPress }: Props) {
  const { t } = useTranslation('relay');
  const { colors } = useTheme();
  const styles = useStyles();
  const signalColors = useMemo(() => ({ blue: colors.signalBlue, red: colors.signalRed }) as Record<SignalColor, string>, [colors]);
  const tint = signalColors[color];
  const label = t(`game.colorNames.${color}`);
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

const useStyles = createThemedStyles((colors) => ({
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
}));
