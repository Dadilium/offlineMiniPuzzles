import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import TopBar from '../components/TopBar';
import { SUPPORTED_LANGUAGES } from '../i18n';
import { setStoredLanguage } from '../i18n/languagePreference';
import { colors, fonts, radii, spacing } from '../theme/colors';
import { PRIVACY_POLICY_URL } from '../config/links';
import appConfig from '../../app.json';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

// Language names are shown in themselves, not translated into the current
// locale -- a French speaker still needs to recognize "English" to pick it.
const LANGUAGE_NAMES: Record<string, string> = { en: 'English', fr: 'Français' };

export default function SettingsScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();

  const selectLanguage = (language: string) => {
    if (language === i18n.language) return;
    i18n.changeLanguage(language);
    setStoredLanguage(language);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <TopBar onBack={() => navigation.goBack()} eyebrow={t('settings.eyebrow')} title={t('settings.title')} />
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

const styles = StyleSheet.create({
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
});
