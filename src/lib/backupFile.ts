import { Share } from 'react-native';

/**
 * Native app: hands the backup text to the system share sheet (save to Files or Notes, AirDrop,
 * LINE…). Restoring is done by pasting it back (我的 → 從備份還原), so no file module is needed.
 */
export async function saveBackupFile(name: string, json: string): Promise<boolean> {
  const result = await Share.share({ title: name, message: json });
  return result.action === Share.sharedAction;
}

/** Whether restoring can open a file picker; otherwise 我的 asks to paste the backup. */
export const canPickBackupFile = false;

export async function pickBackupFile(): Promise<string | null> {
  return null;
}
