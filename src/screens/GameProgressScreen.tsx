import React from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import TopBar from '../components/TopBar';
import { translateDynamic } from '../i18n/dynamicKey';
import { games } from '../games/registry';
import { colors, fonts, radii, spacing } from '../theme/colors';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'GameProgress'>;

export default function GameProgressScreen({ navigation }: Props) {
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.screen}>
      <TopBar onBack={() => navigation.goBack()} eyebrow={t('gameProgress.eyebrow')} title={t('gameProgress.title')} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {games.map((game) => {
          const progress = game.useProgress?.();
          const completed = progress?.completed ?? 0;
          const name = translateDynamic(t, `${game.id}:meta.name`);

          const confirmReset = () => {
            if (!progress || completed === 0) return;
            Alert.alert(
              t('gameProgress.resetConfirmTitle', { game: name }),
              t('gameProgress.resetConfirmMessage', { game: name }),
              [
                { text: t('gameProgress.cancel'), style: 'cancel' },
                { text: t('gameProgress.delete'), style: 'destructive', onPress: progress.reset },
              ]
            );
          };

          return (
            <TouchableOpacity
              key={game.id}
              style={[styles.row, completed === 0 && styles.rowDisabled]}
              activeOpacity={0.75}
              disabled={completed === 0}
              onPress={confirmReset}
            >
              <Text style={styles.rowTitle}>{name}</Text>
              <Text style={styles.rowSub}>{completed > 0 ? t('gameProgress.levelsCompleted', { count: completed }) : t('gameProgress.noProgress')}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDeep },
  scrollContent: { padding: spacing.lg, gap: spacing.sm },
  row: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  rowDisabled: { opacity: 0.5 },
  rowTitle: { fontFamily: fonts.display, fontWeight: '700', fontSize: 14.5, color: colors.text },
  rowSub: { fontSize: 12, color: colors.textDim, marginTop: 2 },
});
