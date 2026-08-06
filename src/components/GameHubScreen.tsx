import React from 'react';
import type { ComponentType } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors, fonts, radii } from '../theme/colors';
import TopBar from './TopBar';

// TopBar's own height (paddingTop + IconButton size) -- used so the banner
// background can extend up behind it and the status bar, uninterrupted.
const TOPBAR_HEIGHT = 54;
const BANNER_CONTENT_HEIGHT = 190;
const ART_SIZE = 116;
const ART_TOP = 16;
const SCRIM_HEIGHT = 92;

interface Props {
  onBack: () => void;
  backAccessibilityLabel?: string;
  accentColor: string;
  CardArt: ComponentType<{ size: number; color: string }>;
  name: string;
  tagline: string;
  playLabel: string;
  onPlay: () => void;
  levelsLabel: string;
  onLevels: () => void;
  howToPlayLabel: string;
  onHowToPlay: () => void;
  /** Extra content rendered directly above the Play button, e.g. Relay's __DEV__-only tools. */
  aboveActions?: React.ReactNode;
}

/** Shared hub screen used by every game: a full-bleed banner (this game's
 * motif over a soft dot pattern + color glow, name overlaid at the base)
 * that runs up behind the status bar and top bar, a tagline, a Play/Resume
 * button, and Levels / How-to-play buttons. */
export default function GameHubScreen({
  onBack,
  backAccessibilityLabel,
  accentColor,
  CardArt,
  name,
  tagline,
  playLabel,
  onPlay,
  levelsLabel,
  onLevels,
  howToPlayLabel,
  onHowToPlay,
  aboveActions,
}: Props) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const headerSpace = insets.top + TOPBAR_HEIGHT;
  const bgHeight = headerSpace + BANNER_CONTENT_HEIGHT;
  const glowCyPercent = ((headerSpace + BANNER_CONTENT_HEIGHT * 0.36) / bgHeight) * 100;

  return (
    <View style={styles.screen}>
      <Svg width={width} height={bgHeight} style={styles.bg}>
        <Defs>
          <Pattern id="bannerDots" width={18} height={18} patternUnits="userSpaceOnUse" patternTransform="rotate(20)">
            <Rect x={0} y={0} width={2.4} height={2.4} fill={accentColor} opacity={0.35} />
          </Pattern>
          <RadialGradient id="bannerGlow" cx="50%" cy={`${glowCyPercent}%`} r="60%">
            <Stop offset="0%" stopColor={accentColor} stopOpacity={0.32} />
            <Stop offset="100%" stopColor={accentColor} stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id="bannerScrim" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={colors.bgDeep} stopOpacity={0} />
            <Stop offset="100%" stopColor={colors.bgDeep} stopOpacity={0.95} />
          </LinearGradient>
        </Defs>
        <Rect width={width} height={bgHeight} fill={`${accentColor}0D`} />
        <Rect width={width} height={bgHeight} fill="url(#bannerDots)" />
        <Rect width={width} height={bgHeight} fill="url(#bannerGlow)" />
        <Rect y={bgHeight - SCRIM_HEIGHT} width={width} height={SCRIM_HEIGHT} fill="url(#bannerScrim)" />
      </Svg>

      <View style={{ paddingTop: insets.top }}>
        <TopBar onBack={onBack} backAccessibilityLabel={backAccessibilityLabel} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.banner}>
          <View style={styles.bannerArt} pointerEvents="none">
            <CardArt size={ART_SIZE} color={accentColor} />
          </View>
          <Text style={styles.bannerTitle}>{name}</Text>
        </View>

        <Text style={styles.tagline}>{tagline}</Text>

        <View style={styles.spacer} />

        {aboveActions}

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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDeep },
  bg: { position: 'absolute', top: 0, left: 0, right: 0 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 32 },
  banner: {
    height: BANNER_CONTENT_HEIGHT,
    marginBottom: 6,
    justifyContent: 'flex-end',
  },
  bannerArt: { position: 'absolute', top: ART_TOP, alignSelf: 'center' },
  bannerTitle: {
    fontFamily: fonts.display,
    fontWeight: '700',
    fontSize: 22,
    color: colors.text,
    marginBottom: 4,
    paddingHorizontal: 20,
    textAlign: 'left',
  },
  tagline: {
    fontSize: 14.5,
    color: colors.textDim,
    lineHeight: 21,
    textAlign: 'left',
    paddingHorizontal: 20,
  },
  spacer: { flex: 1, minHeight: 16 },
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
