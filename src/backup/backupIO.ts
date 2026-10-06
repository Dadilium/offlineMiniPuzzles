import AsyncStorage from '@react-native-async-storage/async-storage';
import { DevSettings, Platform } from 'react-native';
import * as Updates from 'expo-updates';
import appConfig from '../../app.json';
import { backupFileName, buildBackup, isBackupKey, parseBackup, type BackupFile, type ParseResult } from './backupFormat';
import { mergeBackup } from './backupMerge';

// Static imports throw at bundle-evaluation time if a native module isn't
// linked into the running binary -- and an OTA update can reach an older
// binary that predates these three. Same guard as reminders/notifications.ts:
// hide the backup UI instead of crashing.
let FileSystem: typeof import('expo-file-system') | null;
let Sharing: typeof import('expo-sharing') | null;
let DocumentPicker: typeof import('expo-document-picker') | null;
try {
  /* eslint-disable @typescript-eslint/no-var-requires */
  FileSystem = require('expo-file-system');
  Sharing = require('expo-sharing');
  DocumentPicker = require('expo-document-picker');
  /* eslint-enable @typescript-eslint/no-var-requires */
} catch {
  FileSystem = null;
  Sharing = null;
  DocumentPicker = null;
}

export function backupAvailable(): boolean {
  return FileSystem !== null && Sharing !== null && DocumentPicker !== null && Platform.OS !== 'web';
}

async function readAppStorage(): Promise<ReadonlyArray<readonly [string, string | null]>> {
  const keys = (await AsyncStorage.getAllKeys()).filter(isBackupKey);
  return AsyncStorage.multiGet(keys);
}

/**
 * Writes a backup file and opens the system share sheet, so the player can
 * save it wherever they like (Files / iCloud Drive, Google Drive, email...).
 */
export async function exportBackup(dialogTitle: string): Promise<void> {
  if (!FileSystem || !Sharing) throw new Error('backup unavailable');
  const now = new Date();
  const backup = buildBackup(await readAppStorage(), appConfig.expo.version, now);

  const file = new FileSystem.File(FileSystem.Paths.cache, backupFileName(now));
  file.create({ overwrite: true });
  file.write(JSON.stringify(backup));

  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle });
}

export type PickResult = { kind: 'canceled' } | ParseResult;

/** Lets the player pick a backup file and validates it -- nothing is written yet. */
export async function pickBackupFile(): Promise<PickResult> {
  if (!FileSystem || !DocumentPicker) throw new Error('backup unavailable');
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
  if (result.canceled || result.assets.length === 0) return { kind: 'canceled' };
  const text = await new FileSystem.File(result.assets[0].uri).text();
  return parseBackup(text);
}

/**
 * Merges the backup into storage (see `mergeBackup`) and returns how many
 * keys changed. Every provider still holds the old state in memory, so the
 * caller must restart the app right after -- otherwise the next in-memory
 * save would overwrite what was just restored.
 */
export async function applyBackup(backup: BackupFile): Promise<number> {
  const local = Object.fromEntries(await readAppStorage());
  const writes = mergeBackup(local, backup.entries);
  const pairs = Object.entries(writes);
  if (pairs.length > 0) await AsyncStorage.multiSet(pairs);
  return pairs.length;
}

/** Restarts the JS app so every provider reloads from storage. */
export async function restartApp(): Promise<void> {
  if (__DEV__) {
    DevSettings.reload();
    return;
  }
  await Updates.reloadAsync();
}
