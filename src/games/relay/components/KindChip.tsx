import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts } from '../../../theme/colors';
import type { RelayKind } from '../types';

const KIND_LABEL: Record<RelayKind, string> = { circle: 'Circle', beam: 'Beam' };

interface Props {
  kind: RelayKind;
  active: boolean;
  onPress: () => void;
}

/** Picks which kind of relay tapping the board will place next -- only ever
 * shown on levels with mirrors, since beam is strictly weaker than circle
 * without one to bend off. Glyph matches how RelayGrid marks each kind on
 * the board itself (a plain dot for circle, a small cross for beam). */
export default function KindChip({ kind, active, onPress }: Props) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={[styles.chip, active && styles.chipActive]}>
      <View style={styles.glyph}>
        {kind === 'circle' ? (
          <View style={styles.circleGlyph} />
        ) : (
          <>
            <View style={styles.beamGlyphH} />
            <View style={styles.beamGlyphV} />
          </>
        )}
      </View>
      <Text style={[styles.label, active && styles.labelActive]}>{KIND_LABEL[kind]}</Text>
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
  chipActive: { borderColor: colors.gold },
  glyph: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  circleGlyph: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: colors.textDim },
  beamGlyphH: { position: 'absolute', width: 10, height: 1.5, backgroundColor: colors.textDim },
  beamGlyphV: { position: 'absolute', width: 1.5, height: 10, backgroundColor: colors.textDim },
  label: { fontFamily: fonts.mono, fontSize: 11.5, fontWeight: '600', color: colors.textDim },
  labelActive: { color: colors.text },
});
