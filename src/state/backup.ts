/**
 * 備份／還原: progress and settings as one JSON file, to carry them to a reinstalled app (deleting
 * a Home Screen web app deletes its storage) or to another phone. The unfinished block is left out;
 * its answers are already in the progress.
 */
import { dayKey, emptyProgress, type ProgressData } from '@/engine/progress';

import { useProgress } from './progress';
import { useSession } from './session';
import { DEFAULT_SETTINGS, useSettings, type Settings } from './settings';

const APP = 'sukima-nihongo';
/** Bump when the file layout changes; files in older formats must keep restoring. */
export const BACKUP_FORMAT = 1;

export interface Backup {
  app: typeof APP;
  format: number;
  createdAt: number;
  settings: Settings;
  progress: ProgressData;
}

export function createBackup(now = Date.now()): Backup {
  return {
    app: APP,
    format: BACKUP_FORMAT,
    createdAt: now,
    settings: useSettings.getState().settings,
    progress: useProgress.getState().data,
  };
}

export const backupFileName = (backup: Backup) => `sukima-nihongo-${dayKey(backup.createdAt)}.json`;

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Reads a backup file, or says why it can't be restored. */
export function parseBackup(text: string): { backup: Backup } | { error: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: '這不是スキマ日語的備份檔。' };
  }
  if (!isObject(data) || data.app !== APP) return { error: '這不是スキマ日語的備份檔。' };
  if (typeof data.format !== 'number' || data.format > BACKUP_FORMAT) {
    return { error: '這個備份來自較新版本的 App，請先更新 App 再還原。' };
  }
  const p = data.progress;
  if (!isObject(p) || p.v !== 1 || !isObject(p.cards) || !isObject(p.days) || !isObject(p.ability)) {
    return { error: '備份檔內容不完整，無法還原。' };
  }
  const saved = isObject(data.settings) ? (data.settings as Partial<Settings>) : {};
  return {
    backup: {
      app: APP,
      format: data.format,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : 0,
      settings: { ...DEFAULT_SETTINGS, ...saved, focus: { ...DEFAULT_SETTINGS.focus, ...saved.focus } },
      progress: { ...emptyProgress(), ...(p as unknown as ProgressData) },
    },
  };
}

/** One line for the confirmation before restoring. */
export function describeBackup(backup: Backup): string {
  const items = Object.keys(backup.progress.cards).length;
  const days = Object.keys(backup.progress.days).length;
  return `${dayKey(backup.createdAt)} 的備份：學過 ${items} 個項目，學了 ${days} 天。`;
}

/** Replaces the current progress and settings with the backup's, and saves them. */
export function restoreBackup(backup: Backup): void {
  const { settings, update } = useSettings.getState();
  useSession.getState().set(null);
  useProgress.getState().replace(backup.progress);
  update({ ...backup.settings, onboarded: true, lastBackupAt: backup.createdAt, lastBuild: settings.lastBuild });
}
