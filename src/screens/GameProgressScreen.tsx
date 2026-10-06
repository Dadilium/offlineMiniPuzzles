import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import TopBar from '../components/TopBar';
import { translateDynamic } from '../i18n/dynamicKey';
import { games } from '../games/registry';
import { summarizeBackup, type BackupFile } from '../backup/backupFormat';
import { applyBackup, backupAvailable, exportBackup, pickBackupFile, restartApp } from '../backup/backupIO';
import { fonts, radii, spacing } from '../theme/tokens';
import { createThemedStyles } from '../theme/createThemedStyles';
import { useTheme } from '../theme/ThemeProvider';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'GameProgress'>;

const ROW_STAGGER_MS = 30;

export default function GameProgressScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const styles = useStyles();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <TopBar onBack={() => navigation.goBack()} eyebrow={t('gameProgress.eyebrow')} title={t('gameProgress.title')} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {backupAvailable() && <BackupCard />}

        <Text style={styles.sectionLabel}>{t('gameProgress.resetSection')}</Text>
        {games.map((game, i) => {
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
            <Animated.View key={game.id} entering={FadeIn.delay(i * ROW_STAGGER_MS).duration(240)}>
              <TouchableOpacity
                style={[styles.row, completed === 0 && styles.rowDisabled]}
                activeOpacity={0.75}
                disabled={completed === 0}
                onPress={confirmReset}
              >
                <Text style={styles.rowTitle}>{name}</Text>
                <Text style={styles.rowSub}>{completed > 0 ? t('gameProgress.levelsCompleted', { count: completed }) : t('gameProgress.noProgress')}</Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

type BusyAction = 'save' | 'restore' | null;

function BackupCard() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles();
  const [busy, setBusy] = useState<BusyAction>(null);

  const save = async () => {
    setBusy('save');
    try {
      await exportBackup(t('gameProgress.backup.shareTitle'));
    } catch {
      Alert.alert(t('gameProgress.backup.saveFailed'));
    } finally {
      setBusy(null);
    }
  };

  const restore = async (backup: BackupFile) => {
    setBusy('restore');
    try {
      const changed = await applyBackup(backup);
      if (changed === 0) {
        Alert.alert(t('gameProgress.backup.upToDateTitle'), t('gameProgress.backup.upToDateMessage'));
        setBusy(null);
        return;
      }
      await restartApp();
    } catch {
      Alert.alert(t('gameProgress.backup.readFailed'));
      setBusy(null);
    }
  };

  const pickAndConfirm = async () => {
    setBusy('restore');
    let result: Awaited<ReturnType<typeof pickBackupFile>>;
    try {
      result = await pickBackupFile();
    } catch {
      Alert.alert(t('gameProgress.backup.readFailed'));
      setBusy(null);
      return;
    }
    setBusy(null);

    if ('kind' in result) return;
    if (!result.ok) {
      if (result.reason === 'newer-version') Alert.alert(t('gameProgress.backup.newerTitle'), t('gameProgress.backup.newerMessage'));
      else Alert.alert(t('gameProgress.backup.invalidTitle'), t('gameProgress.backup.invalidMessage'));
      return;
    }

    const { backup } = result;
    const summary = summarizeBackup(backup);
    const date = summary.createdAt.toLocaleDateString(i18n.language, { year: 'numeric', month: 'short', day: 'numeric' });
    Alert.alert(
      t('gameProgress.backup.confirmTitle'),
      `${t('gameProgress.backup.confirmSummary', { date, levels: summary.levelsCompleted, dailies: summary.dailiesSolved })}\n\n${t('gameProgress.backup.confirmMessage')}`,
      [
        { text: t('gameProgress.cancel'), style: 'cancel' },
        { text: t('gameProgress.backup.confirm'), onPress: () => void restore(backup) },
      ]
    );
  };

  return (
    <Animated.View entering={FadeInDown.duration(280)} style={styles.backupCard}>
      <View style={styles.backupHeader}>
        <View style={styles.backupIcon}>
          <Ionicons name="cloud-outline" size={20} color={colors.accentBright} />
        </View>
        <View style={styles.flexShrink}>
          <Text style={styles.rowTitle}>{t('gameProgress.backup.title')}</Text>
          <Text style={styles.rowSub}>{t('gameProgress.backup.sub')}</Text>
        </View>
      </View>

      <View style={styles.backupActions}>
        <BackupButton
          label={t('gameProgress.backup.save')}
          icon="share-outline"
          primary
          loading={busy === 'save'}
          disabled={busy !== null}
          onPress={save}
        />
        <BackupButton
          label={t('gameProgress.backup.restore')}
          icon="download-outline"
          loading={busy === 'restore'}
          disabled={busy !== null}
          onPress={pickAndConfirm}
        />
      </View>
    </Animated.View>
  );
}

interface BackupButtonProps {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  primary?: boolean;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}

function BackupButton({ label, icon, primary, loading, disabled, onPress }: BackupButtonProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const contentColor = primary ? colors.text : colors.textDim;

  return (
    <TouchableOpacity
      style={[styles.button, primary && styles.buttonPrimary, disabled && !loading && styles.buttonDisabled]}
      activeOpacity={0.8}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: loading }}
    >
      {loading ? <ActivityIndicator size="small" color={contentColor} /> : <Ionicons name={icon} size={16} color={contentColor} />}
      <Text style={[styles.buttonText, primary && styles.buttonTextPrimary]}>{label}</Text>
    </TouchableOpacity>
  );
}

const useStyles = createThemedStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bgDeep },
  scrollContent: { padding: spacing.lg, gap: spacing.sm },
  flexShrink: { flexShrink: 1 },
  sectionLabel: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textFaint,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  backupCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  backupHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  backupIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backupActions: { flexDirection: 'row', gap: spacing.sm },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 42,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface2,
  },
  buttonPrimary: { backgroundColor: colors.accent, borderColor: colors.accentBright },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '600', color: colors.textDim },
  buttonTextPrimary: { color: colors.text },
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
}));
