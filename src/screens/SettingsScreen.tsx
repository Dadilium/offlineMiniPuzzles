import React from 'react';
import { Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import TopBar from '../components/TopBar';
import { SUPPORTED_LANGUAGES } from '../i18n';
import { setStoredLanguage } from '../i18n/languagePreference';
import { fonts, radii, spacing } from '../theme/tokens';
import { createThemedStyles } from '../theme/createThemedStyles';
import { useTheme } from '../theme/ThemeProvider';
import { darkPalette, lightPalette, type Palette } from '../theme/palettes';
import { PRIVACY_POLICY_URL } from '../config/links';
import appConfig from '../../app.json';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

// Language names are shown in themselves, not translated into the current
// locale -- a French speaker still needs to recognize "English" to pick it.
const LANGUAGE_NAMES: Record<string, string> = { en: 'English', fr: 'Français' };

// "system" (see themePreference.ts) stays the implicit default until the
// player picks one of these explicitly -- it's just not offered as its own
// tile, so the picker only ever shows the two looks a player can compare.
const THEME_MODES: Array<'light' | 'dark'> = ['light', 'dark'];
const THEME_PALETTES: Record<'light' | 'dark', Palette> = { light: lightPalette, dark: darkPalette };

// Taller than wide, echoing the Library screen's own portrait proportions
// rather than a flat little swatch.
const PREVIEW_ASPECT_RATIO = 0.72;

export default function SettingsScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const { colors, scheme, setMode } = useTheme();
  const styles = useStyles();

  const selectLanguage = (language: string) => {
    if (language === i18n.language) return;
    i18n.changeLanguage(language);
    setStoredLanguage(language);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <TopBar onBack={() => navigation.goBack()} title={t('settings.title')} centerTitle />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.label}>{t('settings.languageLabel')}</Text>
          <View style={styles.languageRow}>
            {SUPPORTED_LANGUAGES.map((language) => {
              const active = i18n.language === language;
              return (
                <TouchableOpacity
                  key={language}
                  style={[styles.languagePill, active && styles.languagePillActive]}
                  activeOpacity={0.75}
                  onPress={() => selectLanguage(language)}
                >
                  <Text style={[styles.languagePillText, active && styles.languagePillTextActive]}>{LANGUAGE_NAMES[language]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.75}
          onPress={() => navigation.navigate('GameProgress')}
        >
          <View style={styles.rowBetween}>
            <View style={styles.flexShrink}>
              <Text style={styles.label}>{t('settings.gameProgressLabel')}</Text>
              <Text style={styles.sub}>{t('settings.gameProgressSub')}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.card}>
          <Text style={styles.label}>{t('settings.themeLabel')}</Text>
          <View style={styles.themeRow}>
            {THEME_MODES.map((themeMode) => (
              <ThemeOptionCard
                key={themeMode}
                palette={THEME_PALETTES[themeMode]}
                label={t(`settings.theme.${themeMode}`)}
                active={scheme === themeMode}
                onPress={() => setMode(themeMode)}
              />
            ))}
          </View>
        </View>

        <View style={styles.spacer} />

        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.75}
          onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
        >
          <View style={styles.rowBetween}>
            <View style={styles.flexShrink}>
              <Text style={styles.label}>{t('settings.privacyPolicyLabel')}</Text>
              <Text style={styles.sub}>{t('settings.privacyPolicySub')}</Text>
            </View>
            <Ionicons name="open-outline" size={18} color={colors.textFaint} />
          </View>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>{t('settings.versionLabel')}</Text>
          <Text style={styles.value}>{appConfig.expo.version}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

interface ThemeOptionCardProps {
  palette: Palette;
  label: string;
  active: boolean;
  onPress: () => void;
}

// Preview colors always come from the tile's own palette, not the app's
// current theme -- a player in dark mode still needs to see what light
// actually looks like before switching.
function ThemeOptionCard({ palette, label, active, onPress }: ThemeOptionCardProps) {
  const styles = useStyles();

  return (
    <TouchableOpacity style={[styles.themeCard, active && styles.themeCardActive]} activeOpacity={0.85} onPress={onPress}>
      <View style={[styles.previewStage, { backgroundColor: palette.bgDeep }]}>
        <View style={styles.previewHeader}>
          <View style={[styles.previewHeaderLine, { backgroundColor: palette.textFaint, width: '30%' }]} />
          <View style={[styles.previewHeaderLine, { backgroundColor: palette.text, width: '55%', height: 5 }]} />
        </View>
        <View style={styles.previewGrid}>
          {[palette.signalBlue, palette.signalRed, palette.gold, palette.purple].map((tileColor, i) => (
            <View key={i} style={[styles.previewTile, { backgroundColor: palette.surface2, borderColor: palette.border }]}>
              <View style={[styles.previewTileArt, { backgroundColor: tileColor }]} />
              <View style={styles.previewTileBody}>
                <View style={[styles.previewTileLine, { backgroundColor: palette.textDim }]} />
              </View>
            </View>
          ))}
        </View>
      </View>

      <Text style={styles.themeCardLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const useStyles = createThemedStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bgDeep },
  scrollContent: { flexGrow: 1, padding: spacing.lg, gap: spacing.md },
  spacer: { flex: 1 },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  flexShrink: { flexShrink: 1 },
  label: { fontFamily: fonts.display, fontWeight: '700', fontSize: 14.5, color: colors.text },
  sub: { fontSize: 12, color: colors.textDim, marginTop: 2 },
  value: { fontFamily: fonts.mono, fontSize: 13, color: colors.textDim },
  chevron: { fontSize: 20, color: colors.textFaint, marginLeft: spacing.sm },
  languageRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  languagePill: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface2,
  },
  languagePillActive: { backgroundColor: colors.accent, borderColor: colors.accentBright },
  languagePillText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '600', color: colors.textDim },
  languagePillTextActive: { color: colors.text },
  themeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  themeCard: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  themeCardActive: { borderColor: colors.accent, backgroundColor: colors.surface3 },
  previewStage: {
    width: '100%',
    aspectRatio: PREVIEW_ASPECT_RATIO,
    borderRadius: radii.sm,
    padding: 8,
    gap: 8,
  },
  previewHeader: { gap: 4 },
  previewHeaderLine: { height: 3, borderRadius: 2 },
  previewGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  previewTile: {
    width: '47%',
    height: '47%',
    borderRadius: 7,
    borderWidth: 1,
    overflow: 'hidden',
  },
  previewTileArt: { flex: 1, width: '100%' },
  previewTileBody: { paddingVertical: 5, paddingHorizontal: 6 },
  previewTileLine: { height: 3, width: '70%', borderRadius: 2 },
  themeCardLabel: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
}));
