import React, { useMemo } from 'react';
import type { ComponentType } from 'react';
import { ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { fonts, radii } from '../theme/tokens';
import { createThemedStyles } from '../theme/createThemedStyles';
import { useTheme } from '../theme/ThemeProvider';
import TopBar from './TopBar';

// TopBar's own height (paddingTop + IconButton size) -- used so the banner
// background can extend up behind it and the status bar, uninterrupted.
const TOPBAR_HEIGHT = 54;
const BANNER_CONTENT_HEIGHT = 190;
const ART_SIZE = 116;
const ART_TOP = 16;
const SCRIM_HEIGHT = 92;
const DOT_SPACING = 16;
const DOT_SIZE = 3;
const DOT_ANGLE_DEG = 20;

/** Points for a rotated dot grid, computed directly rather than via SVG's
 * <Pattern patternTransform>, which react-native-svg doesn't reliably apply
 * on iOS (Android renders it fine) -- plain rotated rects have no such
 * platform-specific rendering path to break. Generated oversized in
 * unrotated grid space so the rotated result still fully covers `width` x
 * `height`; anything outside those bounds is clipped by the <Svg> itself. */
function useRotatedDotGrid(width: number, height: number): Array<{ x: number; y: number }> {
  return useMemo(() => {
    const angle = (DOT_ANGLE_DEG * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const cx = width / 2;
    const cy = height / 2;
    const gridWidth = width * cos + height * sin;
    const gridHeight = width * sin + height * cos;
    const cols = Math.ceil(gridWidth / DOT_SPACING / 2) + 1;
    const rows = Math.ceil(gridHeight / DOT_SPACING / 2) + 1;
    const points: Array<{ x: number; y: number }> = [];
    for (let r = -rows; r <= rows; r++) {
      for (let c = -cols; c <= cols; c++) {
        const localX = c * DOT_SPACING;
        const localY = r * DOT_SPACING;
        points.push({
          x: cx + localX * cos - localY * sin,
          y: cy + localX * sin + localY * cos,
        });
      }
    }
    return points;
  }, [width, height]);
}

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
  const { colors } = useTheme();
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const headerSpace = insets.top + TOPBAR_HEIGHT;
  const bgHeight = headerSpace + BANNER_CONTENT_HEIGHT;
  const glowCyPercent = ((headerSpace + BANNER_CONTENT_HEIGHT * 0.36) / bgHeight) * 100;
  const dotGrid = useRotatedDotGrid(width, bgHeight);

  return (
    <View style={styles.screen}>
      <Svg width={width} height={bgHeight} style={styles.bg}>
        <Defs>
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
        {dotGrid.map((p, i) => (
          <Rect key={i} x={p.x - DOT_SIZE / 2} y={p.y - DOT_SIZE / 2} width={DOT_SIZE} height={DOT_SIZE} fill={accentColor} opacity={0.55} />
        ))}
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

const useStyles = createThemedStyles((colors) => ({
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
}));
