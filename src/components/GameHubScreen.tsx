import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts, radii } from '../theme/colors';
import PulseIcon from './PulseIcon';
import TopBar from './TopBar';

interface Props {
  onBack: () => void;
  backAccessibilityLabel?: string;
  pulseColor: string;
  name: string;
  tagline: string;
  playLabel: string;
  onPlay: () => void;
  levelsLabel: string;
  onLevels: () => void;
  howToPlayLabel: string;
  onHowToPlay: () => void;
}

/** Shared hub screen used by every game: pulse icon + name + tagline, a
 * Play/Resume button, and Levels / How-to-play buttons. */
export default function GameHubScreen({
  onBack,
  backAccessibilityLabel,
  pulseColor,
  name,
  tagline,
  playLabel,
  onPlay,
  levelsLabel,
  onLevels,
  howToPlayLabel,
  onHowToPlay,
}: Props) {
  return (
    <SafeAreaView style={styles.screen}>
      <TopBar onBack={onBack} backAccessibilityLabel={backAccessibilityLabel} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          <PulseIcon size={84} dotColor={pulseColor} />
          <Text style={styles.title}>{name}</Text>
          <Text style={styles.tagline}>{tagline}</Text>
        </View>

        <TouchableOpacity style={styles.playBtn} activeOpacity={0.85} onPress={onPlay}>
          <Text style={styles.playBtnText}>{playLabel}</Text>
        </TouchableOpacity>

        <View style={styles.secondaryRow}>
          <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.75} onPress={onLevels}>
            <Text style={styles.secondaryBtnText}>{levelsLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.75} onPress={onHowToPlay}>
            <Text style={styles.secondaryBtnText}>{howToPlayLabel}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDeep },
  scrollContent: { paddingBottom: 32 },
  hero: { marginHorizontal: 20, marginTop: 4, marginBottom: 6, alignItems: 'center', paddingVertical: 18 },
  title: { fontFamily: fonts.display, fontWeight: '700', fontSize: 21, color: colors.text, marginTop: 12 },
  tagline: { fontSize: 12.5, color: colors.textDim, marginTop: 3, maxWidth: 260, lineHeight: 18, textAlign: 'center' },
  playBtn: {
    marginHorizontal: 20,
    marginTop: 2,
    marginBottom: 10,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  playBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  secondaryRow: { flexDirection: 'row', gap: 10, marginHorizontal: 20 },
  secondaryBtn: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  secondaryBtnText: { color: colors.text, fontWeight: '600', fontSize: 14 },
});
