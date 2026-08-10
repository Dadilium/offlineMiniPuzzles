import React, { useEffect, useRef } from 'react';
import { Animated, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { radii } from '../../../theme/tokens';
import { createThemedStyles } from '../../../theme/createThemedStyles';
import { useTheme } from '../../../theme/ThemeProvider';
import type { Tool } from '../engine';

interface ToolButtonProps {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
}

function ToolButton({ icon, label, active, onPress }: ToolButtonProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const scale = useRef(new Animated.Value(active ? 1 : 0.94)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue: active ? 1 : 0.94, friction: 6, tension: 220, useNativeDriver: true }).start();
  }, [active, scale]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} accessibilityLabel={label} accessibilityState={{ selected: active }}>
      <Animated.View style={[styles.btn, active && styles.btnActive, { transform: [{ scale }] }]}>
        <MaterialCommunityIcons name={icon} size={26} color={active ? colors.accent : colors.textDim} />
      </Animated.View>
    </TouchableOpacity>
  );
}

interface Props {
  tool: Tool;
  onChange: (tool: Tool) => void;
  penLabel: string;
  eraserLabel: string;
}

/** Pen/eraser mode switch shown above the Cross Sums board -- pen circles a
 * cell into the sum, eraser crosses it out. Exactly one is active at a time. */
export default function ToolToggle({ tool, onChange, penLabel, eraserLabel }: Props) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <ToolButton icon="pencil-outline" label={penLabel} active={tool === 'pen'} onPress={() => onChange('pen')} />
      <ToolButton icon="eraser" label={eraserLabel} active={tool === 'eraser'} onPress={() => onChange('eraser')} />
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  btn: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radii.md,
  },
  btnActive: { borderColor: colors.accent, backgroundColor: colors.surface },
}));
